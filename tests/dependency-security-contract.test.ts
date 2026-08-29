import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const versionAtLeast = (actual = "", minimum = "") => {
  const parseParts = (v: string) =>
    v.replace(/^[^\d]*/, "").split(".").map((n) => parseInt(n, 10) || 0);

  const [aMaj = 0, aMin = 0, aPatch = 0] = parseParts(actual);
  const [mMaj = 0, mMin = 0, mPatch = 0] = parseParts(minimum);

  if (aMaj !== mMaj) return aMaj > mMaj;
  if (aMin !== mMin) return aMin > mMin;
  return aPatch >= mPatch;
};

describe("dependency-security-contract", () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve("package.json"), "utf8"),
  );

  it("enforces minimum dependency version floors for security", () => {
    expect(
      versionAtLeast(
        pkg.dependencies?.["express-rate-limit"] || pkg.devDependencies?.["express-rate-limit"],
        "8.7.0",
      ),
    ).toBe(true);

    expect(
      versionAtLeast(
        pkg.dependencies?.helmet || pkg.devDependencies?.helmet,
        "8.3.0",
      ),
    ).toBe(true);

    expect(
      versionAtLeast(
        pkg.dependencies?.dompurify || pkg.devDependencies?.dompurify,
        "3.4.14",
      ),
    ).toBe(true);

    expect(
      versionAtLeast(
        pkg.dependencies?.concurrently || pkg.devDependencies?.concurrently,
        "9.2.4",
      ),
    ).toBe(true);
  });
});
