// Pre-written warehouse job description templates, keyed by job_categories.slug.
// Realistic, role-specific copy — no lorem ipsum.

export type JobTemplate = {
  slug: string;
  title: string;
  description: string;
  requirements: string;
};

export const JOB_TEMPLATES: Record<string, JobTemplate> = {
  "forklift-operator": {
    slug: "forklift-operator",
    title: "Forklift Operator",
    description:
      "We're hiring a certified Forklift Operator to move pallets between receiving, storage, and shipping lanes in a high-volume distribution center. You'll operate sit-down counterbalance and stand-up reach trucks, stage outbound loads at the dock, and keep racks organized and FIFO-compliant.\n\nDay-to-day:\n• Load and unload trailers, containers, and rail cars safely\n• Stage product for outbound shipments and put-away inbound freight\n• Perform pre-shift equipment inspections and log issues\n• Maintain a clean, hazard-free aisle and dock area\n• Communicate with shipping/receiving leads via two-way radio\n\nWe run a clean, climate-controlled facility with predictable schedules and OT available.",
    requirements:
      "• Current forklift certification (sit-down + reach preferred)\n• 1+ year warehouse forklift experience\n• Comfortable lifting up to 50 lbs and standing for full shift\n• Steel-toe boots required (boot allowance after 90 days)\n• Ability to pass background check and drug screen",
  },
  "picker-packer": {
    slug: "picker-packer",
    title: "Picker / Packer",
    description:
      "Join our fulfillment team as a Picker/Packer responsible for pulling customer orders, verifying SKUs, packing for shipment, and labeling for parcel carriers. You'll work from an RF scanner and pick cart in a fast-paced e-commerce environment.\n\nDay-to-day:\n• Pick orders from bin/shelf locations using RF scanner\n• Pack items with appropriate dunnage to prevent damage\n• Apply shipping labels and stage on outbound conveyors\n• Hit daily UPH (units per hour) targets with 99.5% accuracy\n• Restock pick locations and report low inventory\n\nWe offer weekly pay, attendance bonuses, and a clear promotion path to lead and trainer roles.",
    requirements:
      "• Ability to stand, walk, bend, and reach for a full shift\n• Lift up to 35 lbs repeatedly\n• Basic reading and math skills\n• Prior pick/pack or retail stockroom experience a plus (not required)\n• Reliable attendance",
  },
  "shipping-receiving": {
    slug: "shipping-receiving",
    title: "Shipping & Receiving Clerk",
    description:
      "We're looking for a detail-oriented Shipping & Receiving Clerk to verify inbound freight against POs, generate BOLs for outbound loads, and coordinate carrier check-in at the dock. You'll be the paperwork backbone of the warehouse.\n\nDay-to-day:\n• Check in drivers, seal/un-seal trailers, and verify pallet counts\n• Match packing slips to POs and flag overages, shortages, damages (OS&D)\n• Generate bills of lading and shipping labels in the WMS\n• Schedule pickups with LTL and parcel carriers\n• Maintain organized dock office records\n\nClean, organized facility with a tight-knit dock team and supportive supervisors.",
    requirements:
      "• 1+ year shipping/receiving or dock-office experience\n• Comfortable with WMS, BOLs, and basic computer use (Excel, Outlook)\n• Strong attention to detail; can spot a wrong SKU at 10 paces\n• Forklift cert a plus\n• Able to lift 50 lbs occasionally",
  },
  "material-handler": {
    slug: "material-handler",
    title: "Material Handler",
    description:
      "Material Handlers keep production lines and outbound lanes flowing by moving raw materials, WIP, and finished goods across the facility. You'll use pallet jacks, walkies, and occasionally sit-down forklifts.\n\nDay-to-day:\n• Move pallets between production cells, staging, and the dock\n• Replenish line-side bins from bulk storage\n• Cycle-count assigned zones and reconcile variances\n• Wrap and label pallets per customer spec\n• Keep aisles and staging lanes clean and safe\n\nWe operate three shifts with a built-in shift differential for 2nd and 3rd.",
    requirements:
      "• 6+ months warehouse or manufacturing experience\n• Pallet jack experience required; forklift cert a strong plus\n• Lift up to 50 lbs and stand for full shift\n• Team player who communicates well across departments",
  },
  "order-selector": {
    slug: "order-selector",
    title: "Order Selector",
    description:
      "Selectors build pallets for our grocery/foodservice customers using voice-pick technology. You'll work in ambient, cooler, and freezer zones — gear is provided for cold environments.\n\nDay-to-day:\n• Build mixed-SKU pallets per voice-pick instructions\n• Stack product safely and tightly to prevent damage in transit\n• Shrink-wrap, label, and stage pallets in dock lanes\n• Operate electric pallet jack (double or triple)\n• Meet engineered productivity standards\n\nStrong earners on production pay can clear $25+/hr. Full benefits day one for full-time hires.",
    requirements:
      "• Electric pallet jack experience preferred (will train the right candidate)\n• Comfortable in cooler (34°F) and freezer (-10°F) environments\n• Lift up to 75 lbs repeatedly\n• Strong work ethic and willingness to hit production standards",
  },
  inventory: {
    slug: "inventory",
    title: "Inventory / Cycle Count Clerk",
    description:
      "Inventory Clerks keep our perpetual inventory accurate through daily cycle counts, location audits, and variance research. You'll partner with operations to investigate root causes and propose fixes.\n\nDay-to-day:\n• Execute daily cycle-count schedules across A/B/C item classes\n• Investigate and resolve inventory variances\n• Reconcile WMS to ERP and post adjustments with documentation\n• Audit slotting and location accuracy\n• Support physical inventory and year-end counts\n\nThis is a great seat for someone who likes data, puzzles, and walking 10k+ steps a day.",
    requirements:
      "• 1+ year inventory or cycle-count experience\n• Working knowledge of WMS (Manhattan, JDA/Blue Yonder, or similar)\n• Solid Excel skills (sorting, filtering, pivots)\n• Detail-oriented; comfortable owning variance investigations",
  },
  "warehouse-associate": {
    slug: "warehouse-associate",
    title: "Warehouse Associate",
    description:
      "General Warehouse Associates are the engine of our operation — supporting picking, packing, receiving, replenishment, and put-away as the day demands. Great entry point with cross-training across the building.\n\nDay-to-day:\n• Rotate across receiving, put-away, picking, packing, and shipping\n• Operate pallet jacks; learn forklifts as you certify\n• Keep workstations and aisles clean and organized\n• Support inventory counts and special projects\n• Follow all safety procedures and PPE requirements\n\nWe promote from within — most of our leads and supervisors started here.",
    requirements:
      "• Reliable transportation and on-time attendance\n• Able to lift up to 50 lbs and be on your feet all shift\n• Positive attitude and willingness to learn\n• No prior warehouse experience required — we'll train",
  },
  "dock-loader": {
    slug: "dock-loader",
    title: "Dock Worker / Loader",
    description:
      "Dock Loaders work the outbound side of the building — staging, loading, and securing freight onto trailers for LTL, TL, and parcel carriers. Fast-paced, physical, and team-driven.\n\nDay-to-day:\n• Stage outbound freight per load plan\n• Load trailers using forklift, pallet jack, or hand\n• Secure loads with straps, load bars, and dunnage\n• Verify pallet counts against BOLs and flag discrepancies\n• Sweep out trailers and keep dock doors clean\n\nWeekly pay, attendance and safety bonuses, and OT available most weeks.",
    requirements:
      "• Forklift certification preferred (we'll certify the right hire)\n• Able to lift 50–75 lbs repeatedly\n• Comfortable in ambient dock temperatures (hot summers, cold winters)\n• Steel-toe boots required",
  },
  "reach-operator": {
    slug: "reach-operator",
    title: "Reach Truck / Cherry Picker Operator",
    description:
      "Reach and Cherry Picker Operators handle high-bay storage in our racking system, from put-away at 30+ feet to order picking from elevated locations.\n\nDay-to-day:\n• Put away inbound pallets to assigned rack locations at height\n• Pick case and each quantities from upper levels using cherry picker\n• Pull full pallets from reserve to replenish forward pick faces\n• Perform pre-shift equipment inspections and log defects\n• Follow strict harness/PPE protocols at all elevated work\n\nWe maintain a rigorous safety program and well-maintained equipment fleet.",
    requirements:
      "• Current reach truck and order-picker (cherry picker) certifications\n• 1+ year experience operating at height (20+ feet)\n• Comfortable wearing a fall-arrest harness for full shift\n• Strong spatial awareness and steady hands",
  },
  supervisor: {
    slug: "supervisor",
    title: "Warehouse Supervisor / Lead",
    description:
      "We're hiring a hands-on Warehouse Supervisor to lead a shift team of 15–30 associates across receiving, picking, packing, and shipping. You'll own daily execution, safety, and labor planning for your area.\n\nDay-to-day:\n• Run daily start-of-shift huddles and assign labor to work plans\n• Drive KPIs: UPH, on-time shipping, accuracy, safety\n• Coach and develop associates; conduct performance conversations\n• Partner with planning and customer service on priorities and exceptions\n• Lead by example on the floor — not behind a desk\n\nClear path to Operations Manager for strong performers.",
    requirements:
      "• 2+ years warehouse leadership experience (lead, supervisor, or equivalent)\n• Comfortable using WMS and Excel for labor and KPI reporting\n• Strong communication and coaching skills\n• Willing to work the shift hours required (1st, 2nd, or 3rd)",
  },
  "quality-control": {
    slug: "quality-control",
    title: "Quality Control Inspector",
    description:
      "QC Inspectors are our last line of defense before product ships to the customer. You'll inspect inbound receipts, in-process WIP, and outbound orders against spec — and stop the line when something's off.\n\nDay-to-day:\n• Perform AQL sampling on inbound receipts\n• Audit outbound orders for pick accuracy and pack integrity\n• Document non-conformances and partner on root-cause/CAPA\n• Maintain calibration log for inspection tools\n• Support customer audits and quality reviews\n\nGreat seat for someone detail-obsessed who likes process and documentation.",
    requirements:
      "• 1+ year QC, QA, or inspection experience (warehouse, manufacturing, or 3PL)\n• Comfortable with measurement tools (calipers, scales, etc.)\n• Strong written communication for NCR documentation\n• ISO 9001 or AIB exposure a plus",
  },
  sanitation: {
    slug: "sanitation",
    title: "Sanitation Associate",
    description:
      "Sanitation Associates keep our food-grade facility audit-ready by executing daily cleaning, sanitizing, and pest-control protocols. Critical role with real responsibility.\n\nDay-to-day:\n• Execute Master Sanitation Schedule (MSS) tasks\n• Clean and sanitize production equipment, floors, drains, and walls\n• Operate floor scrubbers, pressure washers, and foamers\n• Document sanitation logs for audit (SQF, BRC, AIB)\n• Support allergen changeovers and pre-op inspections\n\nWe pay a sanitation premium and provide all PPE and chemicals.",
    requirements:
      "• Prior food-plant or pharma sanitation experience strongly preferred\n• Comfortable working with sanitation chemicals (training provided)\n• Able to lift 50 lbs and work in wet/cold conditions\n• Reliable attendance — sanitation runs on a strict schedule",
  },
};

export const TEMPLATE_LIST = Object.values(JOB_TEMPLATES);
