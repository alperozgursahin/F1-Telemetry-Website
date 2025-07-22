import React, { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";

interface PlotlyChartProps {
  yData: number[];
  metric: string;
  driver: string;
}

const PlotlyChart: React.FC<PlotlyChartProps> = ({ yData, metric, driver }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      Plotly.newPlot(
        ref.current,
        [
          {
            y: yData,
            type: "scatter",
            mode: "lines",
            name: `${driver} - ${metric}`,
          },
        ],
        {
          title: `${metric} Grafiği - ${driver}`,
          xaxis: { title: "Örnek İndeksi" },
          yaxis: { title: metric },
          height: 300,
        },
        { responsive: true }
      );
    }
  }, [yData, metric, driver]);

  return <div ref={ref} />;
};

export default PlotlyChart;
