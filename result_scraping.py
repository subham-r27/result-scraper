import requests
import re
from io import BytesIO
from PyPDF2 import PdfReader
import time

BASE_URL = "http://14.99.184.178:8080/birt/run"

# -------- INPUT SECTION --------
dept = input("Enter Department Code (CG / CS / ET etc): ").upper()
year = input("Enter Year (22 / 23 / 24 etc): ")

start_roll = int(input("Enter Starting Roll Number (e.g., 1): "))
end_roll = int(input("Enter Ending Roll Number (e.g., 120): "))


def extract_details(usn):
    params = {
        "__report": "mydsi/exam/Exam_Result_Sheet_dsce.rptdesign",
        "__format": "pdf",
        "USN": usn
    }

    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        response = requests.get(BASE_URL, params=params, headers=headers, timeout=15)

        if response.status_code != 200 or "application/pdf" not in response.headers.get("Content-Type", ""):
            return None, None

        pdf_file = BytesIO(response.content)
        reader = PdfReader(pdf_file)

        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""

        # ---------- NAME EXTRACTION ----------
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        name = "NAME_NOT_FOUND"

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

    except:
        return None, None


# -------- MAIN PROCESS --------
results = []

print("\nFetching Results...\n")

for i in range(start_roll, end_roll + 1):
    usn = f"1DS{year}{dept}{i:03d}"
    name, sgpa = extract_details(usn)

    if name and sgpa is not None:
        results.append((usn, name, sgpa))
        print(f"{usn} | {name} | {sgpa}")
    else:
        print(f"{usn} | Not Found")

    time.sleep(1)  # Prevent blocking


# -------- STATISTICS --------
if results:
    print("\n" + "="*60)
    print("BATCH SUMMARY")
    print("="*60)

    total_students = len(results)
    avg_sgpa = sum(r[2] for r in results) / total_students

    topper = max(results, key=lambda x: x[2])
    lowest = min(results, key=lambda x: x[2])

    print(f"\nTotal Students Found : {total_students}")
    print(f"Average SGPA         : {avg_sgpa:.2f}")

    print(f"\n🏆 Topper:")
    print(f"{topper[0]} | {topper[1]} | {topper[2]}")

    print(f"\n🔻 Lowest:")
    print(f"{lowest[0]} | {lowest[1]} | {lowest[2]}")

else:
    print("\nNo valid results found.")
