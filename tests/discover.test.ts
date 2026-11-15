import { describe, expect, it } from "vitest";
import type { Listing } from "@/lib/troylens/card";
import { aroundDates, clubs, ideas, inferFormat, offsetText, seedFromListing, withoutOriginalIdentity } from "@/lib/troylens/discover";

const TODAY = "2027-02-01";
const l = (id: string, over: Partial<Listing> = {}): Listing => ({
  id,
  title: `Event ${id}`,
  organizer: "Fictional Club",
  date: "2027-02-20",
  startTime: "18:00",
  endTime: "19:00",
  location: "",
  locationStatus: "tba",
  description: "",
  tags: [],
  isSample: false,
  planVersion: 1,
  publishedAt: "",
  updatedAt: "",
  ...over,
});

describe("format inference", () => {
  it("reads the format from the title first, then the description", () => {
    expect(inferFormat({ title: "Women in Tech Panel", description: "networking after" })).toBe("panel");
    expect(inferFormat({ title: "Spring Night", description: "A hands-on resume workshop." })).toBe("workshop");
    expect(inferFormat({ title: "Alumni Mixer", description: "" })).toBe("networking");
    expect(inferFormat({ title: "Spring Night", description: "Come hang out." })).toBe("other");
  });
  it("matches whole words only", () => {
    expect(inferFormat({ title: "Stalker documentary", description: "" })).toBe("other"); // "talk" inside a word
  });
});

describe("What could our club host?", () => {
  it("puts events sharing the officer's interests first, upcoming before past", () => {
    const list = ideas(
      [l("past", { date: "2027-01-10", tags: ["tech"] }), l("soon", { date: "2027-02-05" }), l("match", { date: "2027-03-01", tags: ["tech"] })],
      ["tech"],
      TODAY,
    );
    expect(list.map((i) => i.listing.id)).toEqual(["match", "past", "soon"]);
    expect(list.find((i) => i.listing.id === "past")!.past).toBe(true);
  });
});

describe("What else is happening around our date?", () => {
  it("lists other clubs' events within a week of each upcoming plan, closest first, flagging similar audiences", () => {
    const around = aroundDates(
      [
        l("same", { date: "2027-02-20", tags: ["career"] }),
        l("near", { date: "2027-02-17" }),
        l("far", { date: "2027-03-15" }),
        l("mine", { date: "2027-02-20" }),
        l("tba", { date: null, startTime: null, endTime: null }),
      ],
      [
        { id: "mine", title: "Networking Night", date: "2027-02-20" },
        { id: "old", title: "Last term", date: "2026-12-01" },
        { id: "nodate", title: "Draft", date: null },
      ],
      ["career"],
      TODAY,
    );
    expect(around).toHaveLength(1);
    expect(around[0].nearby.map((n) => [n.idea.listing.id, n.offsetDays, n.similarAudience])).toEqual([
      ["same", 0, true],
      ["near", -3, false],
    ]);
    expect(offsetText(0)).toBe("Same day");
    expect(offsetText(-3)).toBe("3 days before");
    expect(offsetText(1)).toBe("1 day after");
  });
});

describe("Who could we collaborate with?", () => {
  it("groups by club, ranks shared interests first, and leaves out the officer's own cards", () => {
    const list = clubs(
      [
        l("a1", { organizer: "Robotics Club", tags: ["tech"] }),
        l("a2", { organizer: "robotics club ", title: "Build Your First Robot Workshop", date: "2027-02-10" }),
        l("b1", { organizer: "Film Society", tags: ["arts"] }),
        l("mine", { organizer: "Our Club", tags: ["tech"] }),
      ],
      ["tech"],
      TODAY,
      ["mine"],
    );
    expect(list.map((c) => c.name)).toEqual(["Robotics Club", "Film Society"]);
    expect(list[0].events).toHaveLength(2);
    expect(list[0].sharedTopics).toEqual(["tech"]);
    expect(list[0].next!.listing.id).toBe("a2");
  });
});

describe("Plan something like this", () => {
  it("copies only the format and topic, credits the original, and leaves the other club's details behind", () => {
    const source = l("src", {
      title: "Founders Panel",
      organizer: "Startup Circle",
      date: "2027-03-24",
      location: "Taper Hall 101",
      locationStatus: "confirmed",
      description: "60 students, pizza for everyone, $500 budget.",
      tags: ["entrepreneurship"],
    });
    const seed = seedFromListing(source, "Robotics Club");
    expect(seed.eventType).toBe("info_session");
    expect(seed.title).toBe("Panel on Entrepreneurship");
    expect(seed.organization).toBe("Robotics Club");
    expect(seed.inspiredBy).toEqual({ listingId: "src", title: "Founders Panel", organizer: "Startup Circle" });
    expect(seed.description).toMatch(/like “Founders Panel” by Startup Circle/);
    for (const k of ["date", "startTime", "attendance", "budgetTarget", "food", "venueName", "venueStatus"] as const) expect(seed[k]).toBeUndefined();
    expect(seed.description).not.toMatch(/pizza|\$500|60 students|Taper/);
  });
});

describe("AI proposals for a plan started from another club's event", () => {
  const credit = { listingId: "src", title: "[Sample] Founder Speaker Night", organizer: "Trojan Startup Circle (fictional)" };
  it("drops the original club as organization and its event title, keeping everything else", () => {
    const r = withoutOriginalIdentity({ organization: "Trojan Startup Circle", title: "Founder Speaker Night", attendance: 40, budgetTarget: "300" }, credit);
    expect(r.fields).toEqual({ attendance: 40, budgetTarget: "300" });
    expect(r.dropped).toEqual(["organization", "title"]);
  });
  it("keeps the organizer's own club and a new title", () => {
    const r = withoutOriginalIdentity({ organization: "Robotics Club", title: "Robotics Founders Talk" }, credit);
    expect(r.fields).toEqual({ organization: "Robotics Club", title: "Robotics Founders Talk" });
    expect(withoutOriginalIdentity({ title: "x" }, null).dropped).toEqual([]);
  });
});
