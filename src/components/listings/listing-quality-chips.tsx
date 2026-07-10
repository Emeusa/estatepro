import {
  getQualityIconForLabel,
  normalizeQualityIconLabel,
  QualityIcon,
  QualityIconName
} from "@/components/listings/listing-quality-icons";
import {
  FURNISHING_STATUS_LABELS,
  LAND_SIZE_UNIT_LABELS,
  PROPERTY_CONDITION_LABELS,
  PROPERTY_SIZE_UNIT_LABELS,
  ROAD_ACCESS_LABELS,
  SERVICING_STATUS_LABELS,
  TITLE_DOCUMENT_TYPE_LABELS,
  ZONING_TYPE_LABELS,
  formatCount,
  formatSize
} from "@/lib/listing-quality";
import { ListingRecord } from "@/lib/types";

type HighlightChip = {
  label: string;
  icon: QualityIconName;
};

function addChip(chips: HighlightChip[], label: string | null, icon: QualityIconName) {
  if (!label) {
    return;
  }

  const normalized = normalizeQualityIconLabel(label);
  if (!normalized || chips.some((chip) => normalizeQualityIconLabel(chip.label) === normalized)) {
    return;
  }

  chips.push({ label, icon });
}

function addFeatureChips(chips: HighlightChip[], values: string[]) {
  for (const value of values) {
    addChip(chips, value, getQualityIconForLabel(value));
  }
}

function getHighlightChips(listing: ListingRecord) {
  const chips: HighlightChip[] = [];
  const floorValue = listing.floorLevel
    ? `${listing.floorLevel}${listing.totalFloors ? ` of ${listing.totalFloors}` : ""}`
    : null;

  addChip(chips, listing.location.area || listing.location.city || listing.location.state, "location");
  addChip(chips, formatCount(listing.bedrooms, "Bedroom", "Bedrooms"), "bed");
  addChip(chips, formatCount(listing.bathrooms, "Bathroom", "Bathrooms"), "bath");
  addChip(chips, formatCount(listing.toilets, "Toilet", "Toilets"), "toilet");
  addChip(chips, formatCount(listing.parkingSpaces, "Parking space", "Parking spaces"), "parking");
  addChip(chips, formatSize(listing.propertySize, listing.propertySizeUnit, PROPERTY_SIZE_UNIT_LABELS), "size");
  addChip(chips, formatSize(listing.landSize, listing.landSizeUnit, LAND_SIZE_UNIT_LABELS), "size");
  addChip(chips, listing.propertyCondition ? PROPERTY_CONDITION_LABELS[listing.propertyCondition] : null, "condition");
  addChip(chips, listing.furnishingStatus ? FURNISHING_STATUS_LABELS[listing.furnishingStatus] : null, "sofa");
  addChip(chips, listing.servicingStatus ? SERVICING_STATUS_LABELS[listing.servicingStatus] : null, "shield");
  addChip(chips, listing.yearBuilt ? `Built ${listing.yearBuilt}` : null, "calendar");
  addChip(chips, floorValue ? `Floor ${floorValue}` : null, "floor");
  addChip(chips, listing.titleDocumentType ? TITLE_DOCUMENT_TYPE_LABELS[listing.titleDocumentType] : null, "document");
  addChip(chips, listing.zoningType ? ZONING_TYPE_LABELS[listing.zoningType] : null, "landmark");
  addChip(chips, listing.roadAccess ? ROAD_ACCESS_LABELS[listing.roadAccess] : null, "road");
  addFeatureChips(chips, listing.amenities);
  addFeatureChips(chips, listing.utilities);
  addFeatureChips(chips, listing.safetyFeatures);
  addFeatureChips(chips, listing.nearbyLandmarks);
  addFeatureChips(chips, listing.extraFeatures);

  return chips;
}

export function ListingQualityChips({ listing }: { listing: ListingRecord }) {
  const chips = getHighlightChips(listing);
  if (!chips.length) {
    return null;
  }

  return (
    <div className="rounded-3xl bg-white/65 p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">Property highlights</h2>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {chips.map((chip) => (
          <span
            key={`${chip.icon}-${chip.label}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-950 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
          >
            <QualityIcon icon={chip.icon} />
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}
