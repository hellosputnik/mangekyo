import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocalizationContext } from "./react";
import { createLocalization } from "./locale";
import { Routines } from "../components/Routines";
import { Progress } from "../components/Progress";
import { initialData, defaults, type Routine } from "../engine/model";
it("shows Vietnamese routine options while retaining stable option values and custom names", () => {
  const data = initialData();
  const routine: Routine = {
    id: "routine",
    name: "Buổi tập sáng",
    steps: [{ kind: "pursuit", duration: 300 }],
    rest: 60,
    manual: false,
  };
  const before = JSON.stringify({ data, routine });
  const html = renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization("vi")}>
      <Routines
        data={data}
        eye="Left"
        setEye={() => {}}
        routine={routine}
        setRoutine={() => {}}
        persist={() => {}}
        start={() => {}}
        pursuitPattern={defaults.pattern}
      />
    </LocalizationContext.Provider>,
  );
  expect(html).toContain("Mắt trái");
  expect(html).toContain('value="Left"');
  expect(html).toContain('value="pursuit"');
  expect(html).toContain("Dõi theo mục tiêu");
  expect(html).toContain("Buổi tập sáng");
  expect(html).toContain("Đưa bài tập 1 lên trên");
  expect(JSON.stringify({ data, routine })).toBe(before);
});
it("localizes session history and professional measurements without changing stored records", () => {
  const data = initialData();
  data.sessions = [
    {
      id: "session",
      kind: "visual",
      eye: "Left",
      configuration: defaults,
      startedAt: "2026-10-25T12:00:00Z",
      endedAt: "2026-10-25T12:01:00Z",
      status: "completed",
      activeMilliseconds: 60000,
      slices: [],
      trials: [{ correct: true, responseMilliseconds: 1000, difficulty: 0 }],
      difficulty: 0,
    },
  ];
  data.measurements = [
    {
      id: "measurement",
      date: "2026-10-25",
      eye: "Right",
      method: "Snellen",
      value: "20/40",
    },
  ];
  const before = JSON.stringify(data);
  const html = renderToStaticMarkup(
    <LocalizationContext.Provider value={createLocalization("vi")}>
      <Progress data={data} persist={() => {}} />
    </LocalizationContext.Provider>,
  );
  expect(html).toContain("Lịch sử luyện tập");
  expect(html).toContain("Đã hoàn thành");
  expect(html).toContain("Mắt phải");
  expect(html).toContain("Snellen");
  expect(html).not.toContain("No accuracy measurement");
  expect(JSON.stringify(data)).toBe(before);
});
