// The fixed ingredients for the synthetic dataset. Everything here is invented.
// Day offsets are relative to the day the database is seeded (negative = past).

export const FIRST_NAMES = [
  'Avery', 'Blake', 'Camille', 'Dario', 'Elena', 'Felix', 'Gemma', 'Hollis',
  'Imani', 'Jasper', 'Keiko', 'Lionel', 'Marisol', 'Nadia', 'Otis', 'Priya',
  'Quentin', 'Rosalind', 'Soren', 'Talia', 'Umar', 'Vera', 'Wesley', 'Xiomara',
  'Yusuf', 'Zelda', 'Anton', 'Beatriz', 'Corbin', 'Delphine', 'Emeka', 'Fiona',
  'Gideon', 'Harper', 'Ines', 'Jonah', 'Kalani', 'Lucia', 'Milo', 'Noor',
] as const;

export const LAST_NAMES = [
  'Ashgrove', 'Brightwater', 'Calloway', 'Dunmore', 'Ellery', 'Fairbank', 'Glenhaven',
  'Hartwell', 'Ironwood', 'Juniper', 'Kestrel', 'Larkspur', 'Merriweather', 'Northcott',
  'Oakhurst', 'Pembrook', 'Quillfeather', 'Redfern', 'Stonebridge', 'Thistlewood',
  'Underhill', 'Valemont', 'Westbrook', 'Yarrow', 'Ambermill', 'Birchfield', 'Copperfield',
  'Driftwood', 'Elmstead', 'Foxglove', 'Greystone', 'Hollowell', 'Ivybrook', 'Kingsley',
  'Linden', 'Moorcroft', 'Nettleton', 'Orchard', 'Pinecrest', 'Rookwood',
] as const;

export const CONTACT_NOTES = [
  'Prefers morning shifts.',
  'Can drive on weekdays.',
  'Asked to be paired with a returning volunteer.',
  'Out of town for two weeks.',
  'Happy to help with sorting.',
  'Bringing a friend next time.',
  'Wants to try a delivery route.',
  'Only available after 5 pm.',
] as const;

export interface ShiftPlan {
  role: string;
  startHour: number;
  endHour: number;
  slotsNeeded: number;
  /** How many volunteers the seed signs up. Fewer than slotsNeeded = an open shift. */
  slotsFilled: number;
}

export interface EventPlan {
  name: string;
  location: string;
  dayOffset: number;
  startHour: number;
  endHour: number;
  shifts: ShiftPlan[];
}

const MAIN_HALL = 'Main Hall, 112 Maple Ave';
const WAREHOUSE = 'Pantry Warehouse, Rear Lot';
const LOADING_DOCK = 'Pantry Loading Dock';
const GARDEN = 'Elm Street Community Garden';

/** Past events give volunteers a shift history. Their shifts were fully staffed. */
export const PAST_EVENTS: EventPlan[] = [
  {
    name: 'Food Distribution', location: MAIN_HALL, dayOffset: -35, startHour: 9, endHour: 12,
    shifts: [
      { role: 'Greeter', startHour: 9, endHour: 12, slotsNeeded: 2, slotsFilled: 2 },
      { role: 'Line Server', startHour: 9, endHour: 12, slotsNeeded: 6, slotsFilled: 6 },
      { role: 'Cleanup', startHour: 11, endHour: 12, slotsNeeded: 3, slotsFilled: 3 },
    ],
  },
  {
    name: 'Warehouse Sort', location: WAREHOUSE, dayOffset: -21, startHour: 18, endHour: 20,
    shifts: [{ role: 'Sorter', startHour: 18, endHour: 20, slotsNeeded: 6, slotsFilled: 6 }],
  },
  {
    name: 'Food Distribution', location: MAIN_HALL, dayOffset: -14, startHour: 9, endHour: 12,
    shifts: [
      { role: 'Greeter', startHour: 9, endHour: 12, slotsNeeded: 2, slotsFilled: 2 },
      { role: 'Line Server', startHour: 9, endHour: 12, slotsNeeded: 6, slotsFilled: 6 },
    ],
  },
  {
    name: 'Senior Delivery Route', location: LOADING_DOCK, dayOffset: -7, startHour: 10, endHour: 13,
    shifts: [
      { role: 'Driver', startHour: 10, endHour: 13, slotsNeeded: 4, slotsFilled: 4 },
      { role: 'Packer', startHour: 10, endHour: 11, slotsNeeded: 3, slotsFilled: 3 },
    ],
  },
];

/** The six upcoming events. Several shifts are deliberately short-staffed. */
export const UPCOMING_EVENTS: EventPlan[] = [
  {
    name: 'Food Distribution', location: MAIN_HALL, dayOffset: 2, startHour: 8, endHour: 12,
    shifts: [
      { role: 'Setup', startHour: 8, endHour: 9, slotsNeeded: 3, slotsFilled: 3 },
      { role: 'Greeter', startHour: 9, endHour: 12, slotsNeeded: 2, slotsFilled: 1 },
      { role: 'Line Server', startHour: 9, endHour: 12, slotsNeeded: 6, slotsFilled: 3 },
      { role: 'Cleanup', startHour: 11, endHour: 12, slotsNeeded: 3, slotsFilled: 3 },
    ],
  },
  {
    name: 'Warehouse Sort', location: WAREHOUSE, dayOffset: 5, startHour: 18, endHour: 20,
    shifts: [
      { role: 'Sorter', startHour: 18, endHour: 20, slotsNeeded: 8, slotsFilled: 5 },
      { role: 'Shelf Stocker', startHour: 18, endHour: 20, slotsNeeded: 3, slotsFilled: 3 },
    ],
  },
  {
    name: 'Senior Delivery Route', location: LOADING_DOCK, dayOffset: 8, startHour: 10, endHour: 13,
    shifts: [
      { role: 'Driver', startHour: 10, endHour: 13, slotsNeeded: 5, slotsFilled: 2 },
      { role: 'Packer', startHour: 10, endHour: 11, slotsNeeded: 3, slotsFilled: 3 },
    ],
  },
  {
    name: 'Food Distribution', location: MAIN_HALL, dayOffset: 9, startHour: 9, endHour: 12,
    shifts: [
      { role: 'Greeter', startHour: 9, endHour: 12, slotsNeeded: 2, slotsFilled: 2 },
      { role: 'Line Server', startHour: 9, endHour: 12, slotsNeeded: 6, slotsFilled: 6 },
      { role: 'Cleanup', startHour: 11, endHour: 12, slotsNeeded: 3, slotsFilled: 3 },
    ],
  },
  {
    name: 'Community Garden Harvest', location: GARDEN, dayOffset: 14, startHour: 8, endHour: 11,
    shifts: [{ role: 'Harvester', startHour: 8, endHour: 11, slotsNeeded: 6, slotsFilled: 2 }],
  },
  {
    name: 'Food Drive Kickoff', location: MAIN_HALL, dayOffset: 21, startHour: 17, endHour: 20,
    shifts: [
      { role: 'Donation Intake', startHour: 17, endHour: 20, slotsNeeded: 4, slotsFilled: 1 },
      { role: 'Sorter', startHour: 17, endHour: 20, slotsNeeded: 6, slotsFilled: 2 },
      { role: 'Greeter', startHour: 17, endHour: 20, slotsNeeded: 2, slotsFilled: 0 },
    ],
  },
];

/** Fixed so every reset produces the same names, history, and signups. */
export const RANDOM_SEED = 20261106;
