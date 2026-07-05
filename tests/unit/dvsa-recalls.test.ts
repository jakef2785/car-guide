import { writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { parseDvsaRecallsCsv, parseRecallDate, recallMatchKey } from "@/lib/data-pipeline/dvsa-recalls";

describe("parseRecallDate", () => {
  it("parses UK dd/mm/yyyy", () => {
    expect(parseRecallDate("05/11/2019")?.toISOString().slice(0, 10)).toBe("2019-11-05");
  });
  it("parses ISO", () => {
    expect(parseRecallDate("2019-11-05")?.toISOString().slice(0, 10)).toBe("2019-11-05");
  });
  it("returns null for blank or junk rather than guessing", () => {
    expect(parseRecallDate(null)).toBeNull();
    expect(parseRecallDate("not a date")).toBeNull();
  });
  it("rejects ambiguous 2-digit-year dates and impossible dates instead of guessing", () => {
    expect(parseRecallDate("05/11/19")).toBeNull(); // would be US-parsed by new Date
    expect(parseRecallDate("31/02/2020")).toBeNull(); // 31 Feb -> rolled over, rejected
  });
});

describe("recallMatchKey", () => {
  it("normalises case, punctuation and model-year tokens so VCA + DVSA names line up", () => {
    expect(recallMatchKey("MERCEDES-BENZ", "A-Class MY25")).toBe(recallMatchKey("Mercedes-Benz", "A Class"));
  });
});

describe("parseDvsaRecallsCsv", () => {
  it("reads alias-named columns, attributes make/model, and drops rows with no make/model", () => {
    const dir = mkdtempSync(join(tmpdir(), "dvsa-recalls-"));
    const file = join(dir, "RecallsFile.csv");
    writeFileSync(
      file,
      [
        "Make,Model,Recalls Number,Concern,Defect,Remedy,Launch Date",
        "Ford,Focus,R/2019/123,Braking,Brake hose may chafe,Replace brake hose,05/11/2019",
        ",NoMake,R/2020/000,X,Y,Z,01/01/2020", // dropped: no make
      ].join("\n"),
      "latin1",
    );

    const recalls = parseDvsaRecallsCsv(file);
    expect(recalls).toHaveLength(1);
    expect(recalls[0]).toMatchObject({
      make: "Ford",
      model: "Focus",
      campaignRef: "R/2019/123",
      component: "Braking",
      summary: "Brake hose may chafe",
      remedy: "Replace brake hose",
    });
    expect(recalls[0].recallDate?.toISOString().slice(0, 10)).toBe("2019-11-05");
  });
});
