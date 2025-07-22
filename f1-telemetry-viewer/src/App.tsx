import React, { useEffect, useState } from "react";
// @ts-ignore
import Plotly from "plotly.js-dist-min";

const backendURL = "http://127.0.0.1:8000";

interface Driver {
  Abbreviation: string;
  FullName: string;
}

const analysesOptions = [
  { label: "RPM", value: "RPM" },
  { label: "Speed", value: "Speed" },
  { label: "Throttle", value: "Throttle" },
  { label: "Brake", value: "Brake" },
  { label: "Gear", value: "nGear" },
];

function App() {
  const [years] = useState<number[]>([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
  const [year, setYear] = useState<number>(2023);

  const [races, setRaces] = useState<{ EventName: string; EventDate: string }[]>([]);
  const [race, setRace] = useState<string>("");

  const [sessions] = useState<string[]>(["Practice 1", "Practice 2", "Practice 3", "Qualifying", "Race"]);
  const [session, setSession] = useState<string>("Race");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);

  const [selectedAnalyses] = useState<string[]>(analysesOptions.map((a) => a.value)); // All analyses are static

  const [telemetryData, setTelemetryData] = useState<any>({}); // driver -> metric -> data

  // lapTimeData holds lap time array and tyre compounds per driver
  // Type: { [driver:string]: { lap_times_min: number[], tyre_compounds: string[] } }
  const [lapTimeData, setLapTimeData] = useState<Record<string, { lap_times_min: number[]; tyre_compounds: string[] }> | null>(null);

  const [driverToAdd, setDriverToAdd] = useState<string>("");

  // Fetch races when year changes
  useEffect(() => {
    async function fetchRaces() {
      const res = await fetch(`${backendURL}/races/${year}`);
      const data = await res.json();
      setRaces(data.races || []);
      if (data.races && data.races.length > 0) {
        setRace(data.races[0].EventName);
      } else {
        setRace("");
      }
    }
    fetchRaces();
    setDrivers([]);
    setSelectedDrivers([]);
    setTelemetryData({});
    setLapTimeData(null);
  }, [year]);

  // Clear data on race or session change
  useEffect(() => {
    setDrivers([]);
    setSelectedDrivers([]);
    setTelemetryData({});
    setDriverToAdd("");
    setLapTimeData(null);
  }, [race, session]);

  // Load drivers from backend
  async function loadDrivers() {
    if (!race) {
      alert("Please select a race first.");
      return;
    }
    const eventEncoded = encodeURIComponent(race);
    const res = await fetch(`${backendURL}/drivers/${year}/${eventEncoded}/${session}`);
    const data = await res.json();
    if (!data.error) {
      setDrivers(data.drivers || []);
      setDriverToAdd(data.drivers?.[0]?.Abbreviation || "");
      setSelectedDrivers([]);
      setTelemetryData({});
      setLapTimeData(null);
    } else {
      alert("Failed to load drivers: " + data.error);
      setDrivers([]);
      setDriverToAdd("");
      setSelectedDrivers([]);
      setTelemetryData({});
      setLapTimeData(null);
    }
  }

  // Add new driver and fetch telemetry data
  async function addDriver() {
    if (!driverToAdd) {
      alert("Please select a driver to add.");
      return;
    }
    if (selectedDrivers.includes(driverToAdd)) {
      alert("This driver is already in the list.");
      return;
    }

    const eventEncoded = encodeURIComponent(race);
    const driversParam = driverToAdd;
    const analysesParam = selectedAnalyses.join(",");

    try {
      const res = await fetch(
        `${backendURL}/telemetry/${year}/${eventEncoded}/${session}?drivers=${driversParam}&analyses=${analysesParam}`
      );
      const data = await res.json();
      if (data.error) {
        alert("Failed to fetch telemetry data: " + data.error);
        return;
      }

      setTelemetryData((prev: any) => ({
        ...prev,
        ...data.data,
      }));

      setSelectedDrivers((prev) => [...prev, driverToAdd]);
    } catch (err) {
      alert("Error fetching telemetry data: " + err);
    }
  }

  // Remove driver from list and data
  function removeDriver(driver: string) {
    setSelectedDrivers((prev) => {
      const filtered = prev.filter((d) => d !== driver);
      return filtered;
    });
    setTelemetryData((prev: any) => {
      const newData = { ...prev };
      delete newData[driver];
      return newData;
    });

    setLapTimeData((prev) => {
      if (!prev) return prev;
      const newData = { ...prev };
      delete newData[driver];
      return newData;
    });
  }

  // Load lap times for all selected drivers
  async function loadLapTimes() {
    if (selectedDrivers.length === 0) {
      setLapTimeData(null);
      return;
    }
    const eventEncoded = encodeURIComponent(race);
    const driversParam = selectedDrivers.join(",");
    try {
      const res = await fetch(
        `${backendURL}/laptimes/${year}/${eventEncoded}/${session}?drivers=${driversParam}`
      );
      const data = await res.json();
      if (data.error) {
        alert("Error loading lap times: " + data.error);
        setLapTimeData(null);
        return;
      }

      // Convert backend data format:
      // {
      //   driver1: { lap_times_min: [...], tyre_compounds: [...] },
      //   driver2: {...}
      // }
      setLapTimeData(data.lap_times);

    } catch (err) {
      alert("Error loading lap times: " + err);
      setLapTimeData(null);
    }
  }

  // Update lap times when selected drivers change
  useEffect(() => {
    loadLapTimes();
  }, [selectedDrivers]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        fontFamily: "Segoe UI, sans-serif",
        background: "#121212",
        color: "#fff",
        overflow: "hidden",
      }}
    >
      {/* Left panel */}
      <div
        style={{
          width: "320px",
          padding: "24px",
          backgroundColor: "#1a1a1a",
          overflowY: "auto",
          borderRight: "1px solid #333",
        }}
      >
        <h1 style={{ color: "#FF4136", textAlign: "center", marginBottom: "2rem" }}>
          🏎️ F1
          <br />
          Telemetry Viewer
        </h1>

        <div style={{ marginBottom: "1rem" }}>
          <label>Year:</label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            style={selectStyle}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label>Race:</label>
          <select value={race} onChange={(e) => setRace(e.target.value)} style={selectStyle}>
            {races.map((r) => (
              <option key={r.EventName} value={r.EventName}>
                {r.EventName}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label>Session:</label>
          <select value={session} onChange={(e) => setSession(e.target.value)} style={selectStyle}>
            {sessions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={loadDrivers}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#FF4136",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
            marginBottom: "1rem",
          }}
        >
          Load Drivers
        </button>

        {drivers.length > 0 && (
          <>
            <label>Select and Add Driver:</label>
            <select
              value={driverToAdd}
              onChange={(e) => setDriverToAdd(e.target.value)}
              style={{ ...selectStyle, marginBottom: "0.5rem" }}
            >
              {drivers.map((d) => (
                <option key={d.Abbreviation} value={d.Abbreviation}>
                  {d.FullName} ({d.Abbreviation})
                </option>
              ))}
            </select>
            <button
              onClick={addDriver}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#0074D9",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
                marginBottom: "1rem",
              }}
            >
              Add
            </button>
          </>
        )}

        {selectedDrivers.length > 0 && (
          <>
            <h3>Selected Drivers:</h3>
            <ul style={{ listStyleType: "none", padding: 0 }}>
              {selectedDrivers.map((drv) => (
                <li
                  key={drv}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#222",
                    padding: "6px 12px",
                    borderRadius: "4px",
                    marginBottom: "6px",
                  }}
                >
                  <span>{drv}</span>
                  <button
                    onClick={() => removeDriver(drv)}
                    style={{
                      backgroundColor: "#FF4136",
                      border: "none",
                      color: "#fff",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Right panel: Analyses and Lap Time charts stacked */}
      <div
        style={{
          flex: 1,
          padding: "24px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
          maxHeight: "100vh",
        }}
      >
        {selectedAnalyses.map((metric) => (
          <div
            key={metric}
            style={{ backgroundColor: "#1a1a1a", padding: "12px", borderRadius: "8px" }}
          >
            <h2 style={{ color: "#FF851B", marginBottom: "12px" }}>{metric} Chart</h2>
            <PlotlyMultiDriverChart metric={metric} telemetryData={telemetryData} drivers={selectedDrivers} />
          </div>
        ))}

        {/* Lap Time chart */}
        {lapTimeData && Object.keys(lapTimeData).length > 0 && (
          <div style={{ backgroundColor: "#1a1a1a", padding: "12px", borderRadius: "8px" }}>
            <h2 style={{ color: "#FF851B", marginBottom: "12px" }}>Lap Times Comparison</h2>
            <LapTimeMultiDriverChart lapTimeData={lapTimeData} />
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  width: "100%",
  padding: "8px",
  borderRadius: "4px",
  border: "1px solid #444",
  backgroundColor: "#222",
  color: "#fff",
};

function PlotlyMultiDriverChart({
  metric,
  telemetryData,
  drivers,
}: {
  metric: string;
  telemetryData: any;
  drivers: string[];
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const traces = drivers
      .filter((drv) => telemetryData[drv] && telemetryData[drv][metric])
      .map((drv) => ({
        y: telemetryData[drv][metric],
        type: "scatter",
        mode: "lines",
        name: drv,
      }));

    const layout = {
      title: `${metric} Comparative Chart`,
      xaxis: { title: "Sample Index" },
      yaxis: { title: metric },
      height: 350,
      margin: { t: 40, b: 40 },
      paper_bgcolor: "#121212",
      plot_bgcolor: "#121212",
      font: { color: "#fff" },
    };

    Plotly.newPlot(ref.current, traces, layout, { responsive: true });
  }, [metric, telemetryData, drivers]);

  return <div ref={ref} style={{ width: "100%", height: "350px" }} />;
}

function LapTimeMultiDriverChart({
  lapTimeData,
}: {
  lapTimeData: Record<string, { lap_times_min: number[]; tyre_compounds: string[] }>;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Calculate cumulative lap times for each driver
    const driverElapsedTimes = Object.entries(lapTimeData).map(([driver, data]) => {
      const { lap_times_min, tyre_compounds } = data;
      const cumTimes = lap_times_min.reduce((acc: number[], curr, i) => {
                if (i === 0) return [curr];
        acc.push(acc[i - 1] + curr);
        return acc;
      }, []);
      return { driver, cumTimes, lap_times_min, tyre_compounds };
    });

    const maxElapsed = Math.max(
      ...driverElapsedTimes.map((d) => d.cumTimes[d.cumTimes.length - 1] || 0)
    );

    // 5-minute ticks
    const tickInterval = 5;
    const tickVals: number[] = [];
    const tickTexts: string[] = [];
    for (let i = 0; i <= Math.ceil(maxElapsed); i += tickInterval) {
      tickVals.push(i);
      tickTexts.push(`${i} min`);
    }

    const traces = driverElapsedTimes.map(({ driver, cumTimes, lap_times_min, tyre_compounds }) => {
      const hoverTexts = lap_times_min.map((t, i) => {
        const tyre = tyre_compounds[i] || "Unknown";
        return `Lap ${i + 1}<br>Time: ${formatLapTime(t)}<br>Tyre: ${tyre}`;
      });

      return {
        x: cumTimes,
        y: lap_times_min,
        text: hoverTexts,
        type: "scatter",
        mode: "lines+markers",
        name: driver,
        line: { shape: "spline", smoothing: 1.2 },
        hoverinfo: "text",
      };
    });

    const layout = {
      title: "Lap Times Over Race Duration",
      xaxis: {
        title: { text: "Elapsed Time (minutes)" },
        tickmode: "array",
        tickvals: tickVals,
        ticktext: tickTexts,
      },
      yaxis: {
        title: { text: "Lap Times (minutes)" },
        autorange: true,
      },
      height: 500,
      margin: { t: 50, b: 50, l: 60, r: 20 },
      paper_bgcolor: "#121212",
      plot_bgcolor: "#121212",
      font: { color: "#fff", family: "Segoe UI" },
      hovermode: "closest",
    };

    Plotly.newPlot(ref.current, traces, layout, { responsive: true });

    return () => {
      if (ref.current) Plotly.purge(ref.current);
    };
  }, [lapTimeData]);

  return <div ref={ref} style={{ width: "100%", height: 500 }} />;
}

// Format function:
function formatLapTime(minutesFloat: number): string {
  const totalMilliseconds = minutesFloat * 60 * 1000;
  const minutes = Math.floor(totalMilliseconds / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = Math.floor(totalMilliseconds % 1000);

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds
    .toString()
    .padStart(3, "0")}`;
}

export default App;

