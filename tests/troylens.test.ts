import { describe, expect, it } from "vitest";
import { emptyIntake, type Intake } from "@/lib/schema";
import { cardFromIntake, listingColumns, publishBodySchema, staleFields, type Listing } from "@/lib/troylens/card";
import { explain, parseTags, rankListings } from "@/lib/troylens/rank";

const intake = (over: Partial<Intake> = {}): Intake => ({
  ...emptyIntake(),
  title: "Intro to Arduino",
  organization: "Trojan Makers (fictional)",
  organizerName: "Pat Example",
  date: "2027-03-04",
  dateConfirmed: true,
  startTime: "18:00",
  endTime: "19:30",
  venueName: "Fictional Hall 101",
  venueStatus: "confirmed",
  description: "Internal: budget is tight, ask USG for $300.",
  budgetTarget: "300",
  notes: "private note",
  ...over,
});

describe("cardFromIntake", () => {
  it("shares only the card fields, never budget, notes or the plan description", () => {
    const { fields, notes } = cardFromIntake(intake());
    expect(fields).toEqual({
      title: "Intro to Arduino",
      organizer: "Trojan Makers (fictional)",
      date: "2027-03-04",
      startTime: "18:00",
      endTime: "19:30",
      location: "Fictional Hall 101",
      locationStatus: "confirmed",
    });
    expect(notes).toEqual([]);
    const cols = listingColumns("00000000-0000-4000-8000-000000000000", fields, { description: " Hi ", tags: ["tech", "tech"] }, false, 3);
    expect(Object.keys(cols).sort()).toEqual(
      ["description", "end_time", "event_date", "id", "is_sample", "location", "location_status", "organizer", "plan_version", "start_time", "tags", "title"].sort(),
    );
    expect(JSON.stringify(cols)).not.toMatch(/budget|private note|\$300|Pat Example/);
    expect(cols.tags).toEqual(["tech"]);
    expect(cols.description).toBe("Hi");
  });

  it("withholds an unconfirmed date and its times", () => {
    const { fields, notes } = cardFromIntake(intake({ dateConfirmed: false }));
    expect(fields.date).toBeNull();
    expect(fields.startTime).toBeNull();
    expect(fields.endTime).toBeNull();
    expect(notes.some((n) => /isn.t confirmed/.test(n.text))).toBe(true);
  });

  it("withholds an unconfirmed venue name", () => {
    const { fields } = cardFromIntake(intake({ venueStatus: "requested" }));
    expect(fields.location).toBe("");
    expect(fields.locationStatus).toBe("tba");
  });

  it("drops an end time without a start time", () => {
    expect(cardFromIntake(intake({ startTime: null })).fields.endTime).toBeNull();
  });

  it("blocks publishing without a title and warns before showing a personal name", () => {
    expect(cardFromIntake(intake({ title: "  " })).notes.find((n) => n.level === "blocker")).toBeTruthy();
    const { fields, notes } = cardFromIntake(intake({ organization: "" }));
    expect(fields.organizer).toBe("Pat Example");
    expect(notes.some((n) => /organizer name will be shown/.test(n.text))).toBe(true);
  });

  it("reports which shared fields went stale", () => {
    const a = cardFromIntake(intake()).fields;
    const b = cardFromIntake(intake({ date: "2027-03-11", venueStatus: "requested" })).fields;
    expect(staleFields(a, b)).toEqual(["date", "location"]);
    expect(staleFields(a, a)).toEqual([]);
  });
});

describe("publishBodySchema", () => {
  it("rejects unknown tags, too many tags, and oversize text", () => {
    expect(publishBodySchema.safeParse({ planVersion: 1, description: "", tags: ["crypto"] }).success).toBe(false);
    expect(publishBodySchema.safeParse({ planVersion: 1, description: "", tags: ["tech", "career", "design", "arts", "health", "science"] }).success).toBe(false);
    expect(publishBodySchema.safeParse({ planVersion: 1, description: "x".repeat(1001), tags: [] }).success).toBe(false);
    expect(publishBodySchema.safeParse({ planVersion: 1, description: "ok", tags: ["tech"] }).success).toBe(true);
  });
});

const L = (id: string, tags: Listing["tags"], date: string | null, title = id, startTime: string | null = null): Listing => ({
  id,
  title,
  organizer: "",
  date,
  startTime,
  endTime: null,
  location: "",
  locationStatus: "tba",
  description: "",
  tags,
  isSample: false,
  planVersion: 1,
  publishedAt: "",
  updatedAt: "",
});

describe("Discover ranking", () => {
  const today = "2027-03-01";
  const listings = [
    L("a", ["tech"], "2027-03-10"),
    L("b", ["tech", "career"], "2027-03-20"),
    L("c", ["arts"], "2027-03-02"),
    L("d", ["career"], null),
    L("past", ["tech", "career"], "2027-02-01"),
    L("e", ["tech"], "2027-03-10", "Alpha", "09:00"),
  ];

  it("parses only known tags from the URL", () => {
    expect(parseTags("tech,,career,evil<script>")).toEqual(["tech", "career"]);
    expect(parseTags(undefined)).toEqual([]);
  });

  it("sorts by overlap count, then date (TBA last), then start time", () => {
    const { matches, others } = rankListings(listings, ["tech", "career"], today);
    expect(matches.map((r) => r.listing.id)).toEqual(["b", "e", "a", "d"]);
    expect(others.map((r) => r.listing.id)).toEqual(["c"]);
  });

  it("explains with the viewer's actual selected tags only", () => {
    const { matches } = rankListings(listings, ["career", "tech"], today);
    expect(matches[0].explanation).toBe("Matches your Career and Tech interests");
    expect(matches.find((r) => r.listing.id === "a")!.explanation).toBe("Matches your Tech interest");
    expect(explain([])).toBeNull();
  });

  it("leaves out past events and is chronological with no interests", () => {
    const { matches, others } = rankListings(listings, [], today);
    expect(matches).toEqual([]);
    expect(others.map((r) => r.listing.id)).toEqual(["c", "e", "a", "b", "d"]);
    expect(others.every((r) => r.explanation === null)).toBe(true);
  });
});
