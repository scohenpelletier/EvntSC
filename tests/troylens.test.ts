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

describe("draft public description", async () => {
  const { draftPublicDescription } = await import("@/lib/troylens/card");
  const { emptyIntake } = await import("@/lib/schema");
  it("joins purpose, description, guests, and food, leaving out sentences about money", () => {
    const text = draftPublicDescription({
      ...emptyIntake(),
      purpose: "connect students with alumni",
      description: "We're hosting a networking night for 60 USC students. We have an $800 budget, want food. Come meet people in tech",
      outsideSpeakers: "yes",
      guestCount: 5,
      food: "yes",
    });
    expect(text).toBe(
      "Connect students with alumni. We're hosting a networking night for 60 USC students. Come meet people in tech. 5 outside guests will join us. Food will be provided.",
    );
    expect(text).not.toMatch(/\$|budget/);
  });
  it("falls back to the club name, and is empty when there is nothing shareable", () => {
    expect(draftPublicDescription({ ...emptyIntake(), organization: "Robotics Club" })).toBe("Hosted by Robotics Club.");
    expect(draftPublicDescription(emptyIntake())).toBe("");
  });
});

describe("how-it-went playbook note", async () => {
  const { joinPlaybook, splitPlaybook, MAX_DESCRIPTION } = await import("@/lib/troylens/card");
  it("round-trips the description and the note", () => {
    const stored = joinPlaybook("A founders panel.", "About 50 came; the Q&A ran long.");
    expect(stored).toBe("A founders panel.\n\nHow it went: About 50 came; the Q&A ran long.");
    expect(splitPlaybook(stored)).toEqual({ description: "A founders panel.", howItWent: "About 50 came; the Q&A ran long." });
  });
  it("leaves plain descriptions alone and keeps the note within the length limit", () => {
    expect(joinPlaybook("Just a description.", "  ")).toBe("Just a description.");
    expect(splitPlaybook("Just a description.")).toEqual({ description: "Just a description.", howItWent: "" });
    const long = joinPlaybook("x".repeat(MAX_DESCRIPTION), "It went well.");
    expect(long.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
    expect(splitPlaybook(long).howItWent).toBe("It went well.");
  });
});
