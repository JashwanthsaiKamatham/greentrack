/**
 * Emission factors in kg CO2e per unit.
 * These are rounded, widely used average estimates (DEFRA / IPCC / CEA style figures)
 * intended for awareness and habit tracking, not for certified carbon accounting.
 * `eco: true` marks low-carbon choices that earn bonus points.
 */
export const CATEGORIES = {
  commute: {
    label: 'Commute',
    color: '#0ea5e9',
    subtypes: {
      car_petrol: { label: 'Car (petrol)', unit: 'km', factor: 0.192 },
      car_diesel: { label: 'Car (diesel)', unit: 'km', factor: 0.171 },
      car_electric: { label: 'Car (electric)', unit: 'km', factor: 0.053 },
      carpool: { label: 'Carpool (shared)', unit: 'km', factor: 0.096 },
      motorbike: { label: 'Motorbike / scooter', unit: 'km', factor: 0.103 },
      bus: { label: 'Bus', unit: 'km', factor: 0.089, eco: true },
      train_metro: { label: 'Train / metro', unit: 'km', factor: 0.035, eco: true },
      bicycle: { label: 'Bicycle', unit: 'km', factor: 0, eco: true },
      walk: { label: 'Walking', unit: 'km', factor: 0, eco: true },
      flight: { label: 'Flight', unit: 'km', factor: 0.255 },
    },
  },
  energy: {
    label: 'Energy',
    color: '#f59e0b',
    subtypes: {
      electricity: { label: 'Grid electricity', unit: 'kWh', factor: 0.71 },
      solar: { label: 'Solar electricity', unit: 'kWh', factor: 0.04, eco: true },
      lpg: { label: 'LPG cooking gas', unit: 'kg', factor: 2.98 },
      natural_gas: { label: 'Piped natural gas', unit: 'm³', factor: 2.02 },
    },
  },
  food: {
    label: 'Food',
    color: '#f43f5e',
    subtypes: {
      meal_red_meat: { label: 'Red meat meal', unit: 'meals', factor: 6.5 },
      meal_chicken_fish: { label: 'Chicken / fish meal', unit: 'meals', factor: 1.6 },
      meal_vegetarian: { label: 'Vegetarian meal', unit: 'meals', factor: 0.7, eco: true },
      meal_vegan: { label: 'Vegan meal', unit: 'meals', factor: 0.4, eco: true },
    },
  },
  waste: {
    label: 'Waste',
    color: '#8b5cf6',
    subtypes: {
      landfill: { label: 'General waste (landfill)', unit: 'kg', factor: 0.58 },
      recycled: { label: 'Recycled', unit: 'kg', factor: 0.02, eco: true },
      composted: { label: 'Composted', unit: 'kg', factor: 0.01, eco: true },
    },
  },
  water: {
    label: 'Water',
    color: '#06b6d4',
    subtypes: {
      tap: { label: 'Tap water', unit: 'L', factor: 0.0003 },
      hot: { label: 'Hot water (geyser)', unit: 'L', factor: 0.03 },
    },
  },
  shopping: {
    label: 'Shopping',
    color: '#ec4899',
    subtypes: {
      clothing: { label: 'New clothing', unit: 'items', factor: 12 },
      electronics: { label: 'Electronics', unit: 'items', factor: 60 },
      single_use_plastic: { label: 'Single-use plastic', unit: 'items', factor: 0.08 },
      second_hand: { label: 'Second-hand purchase', unit: 'items', factor: 1, eco: true },
    },
  },
};

export const CHALLENGE_CATEGORIES = {
  plastic: { label: 'Zero plastic', emoji: '🛍️' },
  energy: { label: 'Energy saving', emoji: '⚡' },
  commute: { label: 'Green commute', emoji: '🚲' },
  water: { label: 'Water saving', emoji: '💧' },
  food: { label: 'Sustainable food', emoji: '🥗' },
  waste: { label: 'Recycling', emoji: '♻️' },
  general: { label: 'General', emoji: '🌍' },
};

export const DEFAULT_TARGETS = {
  carbon_kg: 200,
  electricity_kwh: 150,
  water_l: 4000,
  waste_kg: 15,
  recycle_rate: 50,
};

export const LEVELS = [
  { name: 'Seedling', at: 0 },
  { name: 'Sprout', at: 100 },
  { name: 'Sapling', at: 300 },
  { name: 'Young Tree', at: 600 },
  { name: 'Forest Guardian', at: 1000 },
  { name: 'Planet Hero', at: 1500 },
];

export const POINTS = { entry: 10, eco: 5, checkin: 20 };

export const isEco = (category, subtype) => Boolean(CATEGORIES[category]?.subtypes[subtype]?.eco);

export const calcPoints = ({ entries = 0, eco = 0, checkins = 0 }) =>
  entries * POINTS.entry + eco * POINTS.eco + checkins * POINTS.checkin;

export const SEED_CHALLENGES = [
  { title: 'Zero-Plastic Week', description: 'Say no to single-use plastic for 7 days. Carry a bottle, a bag and a box. Check in every day you stay plastic-free.', category: 'plastic', duration_days: 7, co2_per_checkin: 0.5, goal_checkins: 200 },
  { title: 'Energy-Saving Days', description: 'Switch off idle lights, fans and chargers, and set the AC to 24°C or higher. Check in each day you cut energy waste.', category: 'energy', duration_days: 14, co2_per_checkin: 1.2, goal_checkins: 300 },
  { title: 'Car-Free Commute', description: 'Walk, cycle or take public transport instead of driving. Every car-free day counts for the whole community.', category: 'commute', duration_days: 10, co2_per_checkin: 2.4, goal_checkins: 250 },
  { title: 'Meatless Mondays', description: 'Go fully plant-based one day a week. Check in on each meat-free day and discover new recipes.', category: 'food', duration_days: 30, co2_per_checkin: 3, goal_checkins: 150 },
  { title: 'Water Warrior', description: 'Five-minute showers, fixed leaks and full laundry loads only. Check in each day you save water.', category: 'water', duration_days: 14, co2_per_checkin: 0.3, goal_checkins: 300 },
  { title: 'Recycle Right', description: 'Segregate wet, dry and e-waste every single day. Check in whenever your bins are sorted correctly.', category: 'waste', duration_days: 21, co2_per_checkin: 0.6, goal_checkins: 400 },
];
