export type QualityIconName =
  | "air"
  | "airport"
  | "balcony"
  | "bath"
  | "bed"
  | "borehole"
  | "bolt"
  | "bus"
  | "cabinet"
  | "calendar"
  | "camera"
  | "chandelier"
  | "condition"
  | "dining"
  | "dishwasher"
  | "document"
  | "elevator"
  | "fallback"
  | "fire"
  | "floor"
  | "fridge"
  | "gate"
  | "generator"
  | "gym"
  | "home"
  | "hospital"
  | "hotWater"
  | "landmark"
  | "layers"
  | "laundry"
  | "location"
  | "mall"
  | "market"
  | "meter"
  | "microwave"
  | "parking"
  | "pet"
  | "pool"
  | "quarters"
  | "road"
  | "school"
  | "shelf"
  | "shield"
  | "size"
  | "smoke"
  | "sofa"
  | "store"
  | "study"
  | "toilet"
  | "wardrobe"
  | "water"
  | "wifi";

const featureIcons: Record<string, QualityIconName> = {
  "24 hour electricity": "bolt",
  "24 hours electricity": "bolt",
  "24-hour electricity": "bolt",
  ac: "air",
  "air condition": "air",
  "air conditioning": "air",
  airport: "airport",
  balcony: "balcony",
  borehole: "borehole",
  "boys quarter": "quarters",
  "boys quarters": "quarters",
  "bus stop": "bus",
  "cctv camera": "camera",
  "cctv cameras": "camera",
  chandelier: "chandelier",
  "dining area": "dining",
  dishwasher: "dishwasher",
  elevator: "elevator",
  "fire extinguisher": "fire",
  fridge: "fridge",
  "gated estate": "gate",
  generator: "generator",
  gym: "gym",
  hospital: "hospital",
  "hot water": "hotWater",
  internet: "wifi",
  "kitchen cabinet": "cabinet",
  "kitchen cabinets": "cabinet",
  "kitchen shelf": "shelf",
  "laundry room": "laundry",
  "main road": "road",
  market: "market",
  microwave: "microwave",
  "pet friendly": "pet",
  "pop ceiling": "layers",
  "pre paid meter": "meter",
  "pre-paid meter": "meter",
  "prepaid meter": "meter",
  refrigerator: "fridge",
  school: "school",
  "security post": "shield",
  "self contained": "home",
  "shopping mall": "mall",
  "smoke detector": "smoke",
  store: "store",
  "study room": "study",
  "swimming pool": "pool",
  wardrobe: "wardrobe",
  "water heater": "hotWater",
  "water supply": "water"
};

export function normalizeQualityIconLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getQualityIconForLabel(value: string): QualityIconName {
  return featureIcons[normalizeQualityIconLabel(value)] ?? "fallback";
}

function iconPath(icon: QualityIconName) {
  switch (icon) {
    case "air":
      return (
        <>
          <path d="M4 8h10a3 3 0 1 0-3-3" />
          <path d="M3 12h14a3 3 0 1 1-3 3" />
          <path d="M5 16h6" />
        </>
      );
    case "airport":
      return (
        <>
          <path d="M2 11 18 5l-5 6 4 3-2 2-5-2-3 4-2-1 2-5-5-1Z" />
          <path d="M9 9 6 5" />
        </>
      );
    case "balcony":
      return (
        <>
          <path d="M5 9V5h10v4" />
          <path d="M4 9h12v8" />
          <path d="M7 12v5M10 12v5M13 12v5" />
        </>
      );
    case "bath":
      return (
        <>
          <path d="M4 10h12v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2Z" />
          <path d="M6 10V6a2 2 0 0 1 4 0v1" />
          <path d="M6 17l-1 2M14 17l1 2" />
        </>
      );
    case "bed":
      return (
        <>
          <path d="M3 7v10" />
          <path d="M3 12h14v5" />
          <path d="M5 9h4v3H5z" />
          <path d="M9 10h5a3 3 0 0 1 3 3" />
        </>
      );
    case "borehole":
      return (
        <>
          <path d="M5 17h10M6 8h8M7 8v7h6V8" />
          <path d="M10 3v5M8 5h4" />
          <path d="M10 11c-1 1-1 2 0 3 1-1 1-2 0-3Z" />
        </>
      );
    case "bolt":
      return <path d="m11 2-7 10h6l-1 6 7-10h-6l1-6Z" />;
    case "bus":
      return (
        <>
          <path d="M5 4h10a2 2 0 0 1 2 2v8H3V6a2 2 0 0 1 2-2Z" />
          <path d="M3 9h14M6 16v1M14 16v1" />
          <circle cx="6" cy="12.5" r=".8" />
          <circle cx="14" cy="12.5" r=".8" />
        </>
      );
    case "cabinet":
      return (
        <>
          <path d="M5 4h10v14H5z" />
          <path d="M5 10h10" />
          <path d="M9 7h2M9 14h2" />
        </>
      );
    case "calendar":
      return (
        <>
          <path d="M5 4h10v13H5z" />
          <path d="M5 8h10M8 3v3M12 3v3" />
        </>
      );
    case "camera":
      return (
        <>
          <path d="M4 7h3l1-2h4l1 2h3v9H4z" />
          <circle cx="10" cy="11.5" r="2.5" />
        </>
      );
    case "chandelier":
      return (
        <>
          <path d="M10 3v4M5 7h10" />
          <path d="M6 7c0 3 2 5 4 5s4-2 4-5" />
          <path d="M7 14h6M8 17h4" />
        </>
      );
    case "condition":
      return (
        <>
          <path d="M10 3 4 6v5c0 4 3 6 6 7 3-1 6-3 6-7V6l-6-3Z" />
          <path d="m7 11 2 2 4-5" />
        </>
      );
    case "dining":
      return (
        <>
          <path d="M6 3v7M4 3v7M8 3v7M4 7h4" />
          <path d="M6 10v7" />
          <path d="M13 3v14" />
          <path d="M11 3h4v7h-4z" />
        </>
      );
    case "dishwasher":
      return (
        <>
          <path d="M5 3h10v14H5z" />
          <path d="M7 6h6" />
          <path d="M8 11c1.2-1 2.8-1 4 0M8 14c1.2-1 2.8-1 4 0" />
        </>
      );
    case "document":
      return (
        <>
          <path d="M6 3h6l3 3v11H6z" />
          <path d="M12 3v4h4M8 11h5M8 14h4" />
        </>
      );
    case "elevator":
      return (
        <>
          <path d="M5 3h10v14H5z" />
          <path d="M8 7 10 5l2 2M8 13l2 2 2-2" />
        </>
      );
    case "fire":
      return (
        <>
          <path d="M8 4h4v4H8zM10 8v4" />
          <path d="M7 12h6v5H7z" />
          <path d="M8 15h4" />
        </>
      );
    case "floor":
      return (
        <>
          <path d="M5 17h10" />
          <path d="M6 14h8M7 11h6M8 8h4M9 5h2" />
        </>
      );
    case "fridge":
      return (
        <>
          <path d="M6 3h8v14H6z" />
          <path d="M6 9h8" />
          <path d="M9 6v1M9 12v1" />
        </>
      );
    case "gate":
      return (
        <>
          <path d="M4 17V7l6-4 6 4v10" />
          <path d="M7 17v-6h6v6" />
          <path d="M10 11v6" />
        </>
      );
    case "generator":
      return (
        <>
          <path d="M4 7h11v8H4z" />
          <path d="M7 7V5h5v2M7 11h3" />
          <circle cx="13" cy="11" r="1" />
          <path d="M15 9h2v4h-2" />
        </>
      );
    case "gym":
      return (
        <>
          <path d="M2 10h16" />
          <path d="M4 7v6M7 6v8M13 6v8M16 7v6" />
        </>
      );
    case "home":
      return (
        <>
          <path d="M3 10 10 4l7 6" />
          <path d="M5 9v8h10V9" />
          <path d="M8 17v-5h4v5" />
        </>
      );
    case "hospital":
      return (
        <>
          <path d="M5 4h10v13H5z" />
          <path d="M8 10h4M10 8v4" />
          <path d="M7 17v-3h6v3" />
        </>
      );
    case "hotWater":
      return (
        <>
          <path d="M7 4c-2 2 2 3 0 5M11 4c-2 2 2 3 0 5" />
          <path d="M5 13h10" />
          <path d="M6 13a4 4 0 0 0 8 0" />
        </>
      );
    case "landmark":
      return (
        <>
          <path d="M10 3 4 7h12l-6-4Z" />
          <path d="M5 8v7M9 8v7M13 8v7" />
          <path d="M3 17h14" />
        </>
      );
    case "layers":
      return (
        <>
          <path d="m10 3 7 4-7 4-7-4 7-4Z" />
          <path d="m3 11 7 4 7-4" />
          <path d="m3 15 7 4 7-4" />
        </>
      );
    case "laundry":
      return (
        <>
          <path d="M5 3h10v14H5z" />
          <path d="M7 6h.01M10 6h.01" />
          <circle cx="10" cy="12" r="3" />
          <path d="M8 12c1 .8 3 .8 4 0" />
        </>
      );
    case "location":
      return (
        <>
          <path d="M10 18s6-5 6-10A6 6 0 0 0 4 8c0 5 6 10 6 10Z" />
          <circle cx="10" cy="8" r="2" />
        </>
      );
    case "mall":
      return (
        <>
          <path d="M5 8h10l-1 9H6L5 8Z" />
          <path d="M8 8a2 2 0 0 1 4 0" />
          <path d="M6 11h8" />
        </>
      );
    case "market":
      return (
        <>
          <path d="M4 7h12l-1 4H5L4 7Z" />
          <path d="M5 11v6h10v-6" />
          <path d="M8 17v-4h4v4" />
          <path d="M6 4h8l2 3H4l2-3Z" />
        </>
      );
    case "meter":
      return (
        <>
          <path d="M4 15a6 6 0 1 1 12 0" />
          <path d="M10 15l3-5" />
          <path d="M5 17h10" />
        </>
      );
    case "microwave":
      return (
        <>
          <path d="M3 6h14v10H3z" />
          <path d="M6 9h6v4H6z" />
          <path d="M14 9h1M14 12h1" />
        </>
      );
    case "parking":
      return (
        <>
          <path d="M6 17V4h5a4 4 0 0 1 0 8H6" />
          <path d="M9 8h3" />
        </>
      );
    case "pet":
      return (
        <>
          <circle cx="6" cy="7" r="1.3" />
          <circle cx="10" cy="5.5" r="1.3" />
          <circle cx="14" cy="7" r="1.3" />
          <path d="M6.5 14c0-2 1.5-4 3.5-4s3.5 2 3.5 4c0 1.4-1.1 2.5-2.5 2.5h-2c-1.4 0-2.5-1.1-2.5-2.5Z" />
        </>
      );
    case "pool":
      return (
        <>
          <path d="M4 12c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0" />
          <path d="M4 16c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0" />
          <path d="M7 10V5a2 2 0 0 1 4 0" />
        </>
      );
    case "quarters":
      return (
        <>
          <path d="M3 10 8 6l5 4v7H3z" />
          <path d="M12 9h5v8h-5" />
          <path d="M6 17v-4h3v4" />
        </>
      );
    case "road":
      return (
        <>
          <path d="M7 18 9 3h2l2 15" />
          <path d="M10 6v2M10 11v2M10 16v2" />
        </>
      );
    case "school":
      return (
        <>
          <path d="M10 3 3 7l7 4 7-4-7-4Z" />
          <path d="M5 9v4c2 2 8 2 10 0V9" />
          <path d="M17 7v5" />
        </>
      );
    case "shelf":
      return (
        <>
          <path d="M4 6h12M4 11h12M4 16h12" />
          <path d="M6 6v10M14 6v10" />
        </>
      );
    case "shield":
      return (
        <>
          <path d="M10 3 4 6v5c0 4 3 6 6 7 3-1 6-3 6-7V6l-6-3Z" />
          <path d="M10 8v4M10 15h.01" />
        </>
      );
    case "size":
      return (
        <>
          <path d="M4 14 14 4" />
          <path d="M5 8V5h3M12 15h3v-3" />
          <path d="M3 17h14V3" />
        </>
      );
    case "smoke":
      return (
        <>
          <circle cx="10" cy="7" r="4" />
          <path d="M7 13c2-1 4-1 6 0M6 16c2.7-1.2 5.3-1.2 8 0" />
        </>
      );
    case "sofa":
      return (
        <>
          <path d="M5 11V8a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v3" />
          <path d="M4 11h12v5H4z" />
          <path d="M4 16v2M16 16v2" />
        </>
      );
    case "store":
      return (
        <>
          <path d="M5 6h10v11H5z" />
          <path d="M7 6a3 3 0 0 1 6 0" />
          <path d="M8 11h4M8 14h3" />
        </>
      );
    case "study":
      return (
        <>
          <path d="M4 5h5a3 3 0 0 1 3 3v9a3 3 0 0 0-3-3H4z" />
          <path d="M16 5h-4v12a3 3 0 0 1 3-3h1z" />
        </>
      );
    case "toilet":
      return (
        <>
          <path d="M6 3h8v6H6z" />
          <path d="M5 9h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V9Z" />
          <path d="M8 17h4" />
        </>
      );
    case "wardrobe":
      return (
        <>
          <path d="M5 3h10v15H5z" />
          <path d="M10 3v15" />
          <path d="M8 10h.01M12 10h.01" />
        </>
      );
    case "water":
      return (
        <>
          <path d="M10 3s5 5 5 9a5 5 0 0 1-10 0c0-4 5-9 5-9Z" />
          <path d="M8 13a2 2 0 0 0 3 1.7" />
        </>
      );
    case "wifi":
      return (
        <>
          <path d="M4 8a9 9 0 0 1 12 0" />
          <path d="M7 11a5 5 0 0 1 6 0" />
          <path d="M10 15h.01" />
        </>
      );
    default:
      return (
        <>
          <path d="M10 3 4 7v10h12V7l-6-4Z" />
          <path d="M8 17v-5h4v5" />
        </>
      );
  }
}

export function QualityIcon({ icon, className }: { icon: QualityIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className ?? "h-4 w-4 shrink-0 text-slate-950"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 20 20"
    >
      {iconPath(icon)}
    </svg>
  );
}
