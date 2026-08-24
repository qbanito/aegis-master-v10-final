// Synthetic PAPER samples — must only ever be called when systemDataMode === "DEMO".
// discoverProducts() (core/discovery.js) enforces this boundary; do not call this from anywhere else.
export function syntheticCandidates(source) {
  const templates = source === "amazon"
    ? [["Compact USB-C Travel Hub", 28.99, 4.9, "electronics"], ["Portable Recovery Massager", 49.99, 4.7, "wellness"]]
    : [["Rechargeable Motion Sensor Light", 19.90, 4.8, "home"], ["Magnetic Desk Organizer", 16.50, 4.6, "office"]];
  return templates.map(([name, price, rating, category], index) => ({
    id: `${source}-paper-${index + 1}`,
    source,
    sourceStatus: "PAPER_SAMPLE",
    paper: true,
    name,
    category,
    price,
    rating,
    estimatedCost: Number((price * .36).toFixed(2)),
    estimatedMargin: Number((price * .42).toFixed(2)),
    demandScore: 70 + index * 7,
    imageUrl: "",
    discoveredAt: new Date().toISOString()
  }));
}
