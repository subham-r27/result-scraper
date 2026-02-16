from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

import requests
import re
import time
from io import BytesIO
from statistics import mean, median, stdev

from PyPDF2 import PdfReader


BASE_URL = "http://14.99.184.178:8080/birt/run"


class BatchRequest(BaseModel):
    dept: str
    year: str
    # Optional delay between requests (in seconds) to avoid blocking the server
    delay_seconds: float = 1.0


app = FastAPI(
    title="Result Scraping & Analytics API",
    description="Fetches student results from the DSCE portal and computes advanced statistics.",
    version="1.0.0",
)

# Configure CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default port
        "http://localhost:3000",  # Alternative React dev server
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)


def extract_details(usn: str) -> tuple[Optional[str], Optional[float]]:
    """
    Fetches the PDF for a given USN and extracts the student's name and SGPA/CGPA.
    Returns (name, sgpa) or (None, None) if not found/parsable.
    """
    params = {
        "__report": "mydsi/exam/Exam_Result_Sheet_dsce.rptdesign",
        "__format": "pdf",
        "USN": usn,
    }

    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        response = requests.get(BASE_URL, params=params, headers=headers, timeout=15)

        if response.status_code != 200 or "application/pdf" not in response.headers.get(
            "Content-Type", ""
        ):
            return None, None

        pdf_file = BytesIO(response.content)
        reader = PdfReader(pdf_file)

        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""

        # ---------- NAME EXTRACTION ----------
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        name: str = "NAME_NOT_FOUND"

        for i, line in enumerate(lines):
            if "Name of the Student" in line:
                if ":" in line:
                    possible = line.split(":", 1)[1].strip()
                    if possible:
                        name = possible
                        break
                if i + 1 < len(lines):
                    name = lines[i + 1].strip()
                    break

        # ---------- SGPA / CGPA EXTRACTION ----------
        sgpa_match = re.search(r"SGPA\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)", text)
        if not sgpa_match:
            sgpa_match = re.search(r"CGPA\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)", text)

        if not sgpa_match:
            return name, None

        sgpa = float(sgpa_match.group(1))
        return name, sgpa

    except Exception:
        # You may want to log the exception in a real app
        return None, None


def compute_percentiles(sorted_values: List[float]) -> Dict[str, float]:
    """
    Compute simple 25th, 50th, and 75th percentiles for a sorted list.
    """
    n = len(sorted_values)
    if n == 0:
        return {"p25": 0.0, "p50": 0.0, "p75": 0.0}

    def percentile(p: float) -> float:
        if n == 1:
            return sorted_values[0]
        k = (n - 1) * p
        f = int(k)
        c = min(f + 1, n - 1)
        if f == c:
            return sorted_values[int(k)]
        d0 = sorted_values[f] * (c - k)
        d1 = sorted_values[c] * (k - f)
        return d0 + d1

    return {
        "p25": round(percentile(0.25), 2),
        "p50": round(percentile(0.50), 2),
        "p75": round(percentile(0.75), 2),
    }


def build_distribution(sgpas: List[float]) -> Dict[str, int]:
    """
    Build a simple SGPA distribution across ranges.
    """
    buckets = {
        ">= 9.0": 0,
        "8.0 - 8.99": 0,
        "7.0 - 7.99": 0,
        "6.0 - 6.99": 0,
        "< 6.0": 0,
    }

    for s in sgpas:
        if s >= 9.0:
            buckets[">= 9.0"] += 1
        elif s >= 8.0:
            buckets["8.0 - 8.99"] += 1
        elif s >= 7.0:
            buckets["7.0 - 7.99"] += 1
        elif s >= 6.0:
            buckets["6.0 - 6.99"] += 1
        else:
            buckets["< 6.0"] += 1

    return buckets


@app.post("/analyze-results")
def analyze_results(payload: BatchRequest) -> Dict[str, Any]:
    """
    Fetch results for all USNs in the given department and year, automatically detecting the range.
    """
    dept = payload.dept.upper()
    year = payload.year
    delay = max(payload.delay_seconds, 0.0)

    results: List[Dict[str, Any]] = []
    consecutive_failures = 0
    max_consecutive_failures = 20  # Stop after 20 consecutive failures
    roll_number = 1
    max_roll_to_check = 500  # Safety limit to prevent infinite loops

    # Start from roll 1 and keep fetching until we hit max_consecutive_failures
    while roll_number <= max_roll_to_check:
        usn = f"1DS{year}{dept}{roll_number:03d}"
        name, sgpa = extract_details(usn)

        if name and sgpa is not None:
            results.append({"usn": usn, "name": name, "sgpa": sgpa})
            consecutive_failures = 0  # Reset counter on success
        else:
            consecutive_failures += 1
            # If we've hit too many consecutive failures, we've likely reached the end
            if consecutive_failures >= max_consecutive_failures:
                break

        # Avoid hammering the remote server
        if delay > 0:
            time.sleep(delay)

        roll_number += 1

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No valid results found for department {dept} and year {year}."
        )

    sgpas = [r["sgpa"] for r in results]
    total_students = len(results)
    avg_sgpa = mean(sgpas)

    sorted_by_sgpa = sorted(results, key=lambda r: r["sgpa"])
    lowest = sorted_by_sgpa[0]
    topper = sorted_by_sgpa[-1]

    # Top / Bottom N (e.g., Top 5 & Lowest 5)
    top_n = sorted_by_sgpa[-5:][::-1]
    bottom_n = sorted_by_sgpa[:5]

    # Advanced statistics
    med = median(sgpas)
    std_dev = stdev(sgpas) if len(sgpas) > 1 else 0.0
    percentiles = compute_percentiles(sorted(sgpas))
    distribution = build_distribution(sgpas)

    # Find the actual roll range from results
    roll_numbers = [int(r["usn"][-3:]) for r in results]
    min_roll = min(roll_numbers) if roll_numbers else 0
    max_roll = max(roll_numbers) if roll_numbers else 0

    response: Dict[str, Any] = {
        "input": {
            "dept": dept,
            "year": year,
            "roll_range": f"{min_roll:03d} - {max_roll:03d}" if roll_numbers else "N/A",
            "total_rolls_checked": roll_number - 1,
            "delay_seconds": delay,
        },
        "summary": {
            "total_students": total_students,
            "average_sgpa": round(avg_sgpa, 2),
            "min_sgpa": lowest["sgpa"],
            "max_sgpa": topper["sgpa"],
            "median_sgpa": round(med, 2),
            "std_dev_sgpa": round(std_dev, 3),
            "percentiles": percentiles,
            "distribution": distribution,
        },
        "topper": topper,
        "lowest": lowest,
        "top_performers": top_n,
        "lowest_performers": bottom_n,
        "results": results,
    }

    return response


# Simple health check
@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}

