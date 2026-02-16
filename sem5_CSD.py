import requests
import re
from io import BytesIO
from PyPDF2 import PdfReader
import time

BASE_URL = "http://14.99.184.178:8080/birt/run"

def extract_details(usn):
    params = {
        "__report": "mydsi/exam/Exam_Result_Sheet_dsce.rptdesign",
        "__format": "pdf",
        "USN": usn
    }

    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    try:
        response = requests.get(BASE_URL, params=params, headers=headers, timeout=15)

        if response.status_code != 200 or "application/pdf" not in response.headers.get("Content-Type", ""):
            return "ERROR_FETCH", "ERROR_FETCH"

        pdf_file = BytesIO(response.content)
        reader = PdfReader(pdf_file)

        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""

        # ---------- NAME EXTRACTION (LINE BASED) ----------
        lines = [line.strip() for line in text.split("\n") if line.strip()]

        name = "NAME_NOT_FOUND"

        for i, line in enumerate(lines):
            if "Name of the Student" in line:
                # If name is on same line after colon
                if ":" in line:
                    possible_name = line.split(":", 1)[1].strip()
                    if possible_name:
                        name = possible_name
                        break
                # Otherwise take next line
                if i + 1 < len(lines):
                    name = lines[i + 1].strip()
                    break

        # ---------- SGPA / CGPA EXTRACTION ----------
        sgpa_match = re.search(r"\bSGPA\b\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)", text)
        if not sgpa_match:
            sgpa_match = re.search(r"\bCGPA\b\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)", text)

        sgpa = sgpa_match.group(1) if sgpa_match else "SGPA_NOT_FOUND"

        return name, sgpa

    except Exception:
        return "ERROR", "ERROR"


# -------- MAIN LOOP --------
print("\nUSN        | NAME                                | SGPA/CGPA")
print("-" * 80)

for i in range(1, 64):
    usn = f"1DS23CG{i:03d}"
    name, sgpa = extract_details(usn)

    print(f"{usn} | {name:<35} | {sgpa}")

    time.sleep(1)
