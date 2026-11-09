/**
 * Alamdar Company Sports Club - Box Cricket Auction
 * Initial Tournament Data: 12 Teams, 8 Islamic Stone Sets, 96 Players,
 * and Pre-configured Credentials for Admin and 12 Team Owners.
 */

const SET_CONFIG = [
  { id: 'set_aqeeq', name: 'Aqeeq', meaning: 'Carnelian / Agate', color: '#dc2626' },
  { id: 'set_firoza', name: 'Firoza', meaning: 'Turquoise', color: '#06b6d4' },
  { id: 'set_yaqoot', name: 'Yaqoot', meaning: 'Ruby', color: '#e11d48' },
  { id: 'set_zumurrud', name: 'Zumurrud', meaning: 'Emerald', color: '#059669' },
  { id: 'set_marjan', name: 'Marjan', meaning: 'Coral', color: '#ea580c' },
  { id: 'set_pukhraj', name: 'Pukhraj', meaning: 'Yellow Sapphire', color: '#d97706' },
  { id: 'set_neelam', name: 'Neelam', meaning: 'Blue Sapphire', color: '#2563eb' },
  { id: 'set_durenajaf', name: 'Dur-e-Najaf', meaning: 'Pearl Quartz', color: '#7c3aed' }
];

// Admin Credentials
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'alamdar@admin2026',
  role: 'admin',
  name: 'Tournament Committee Admin'
};

// 12 Teams with Individual Credentials & Assigned Stone Sets for Playing Captains
const INITIAL_TEAMS = [
  { id: 'team_01', name: 'Fatemi Falcons', icon: '🦅', username: 'fatemi', password: 'fatemi@2026', ownerName: 'Burhanuddin Hussain', phone: '9820011111', playingOwner: 'Burhanuddin (C)', captainSetId: 'set_aqeeq', captainSetName: 'Aqeeq', color: '#3b82f6' },
  { id: 'team_02', name: 'Kanchwala Knight Riders', icon: '🛡️', username: 'kanchwala', password: 'kanchwala@2026', ownerName: 'Taha Sajid Husain kanchwala', phone: '9820022222', playingOwner: 'Taha (C)', captainSetId: 'set_firoza', captainSetName: 'Firoza', color: '#8b5cf6' },
  { id: 'team_03', name: 'Telwala Challengers', icon: '🦁', username: 'telwala', password: 'telwala@2026', ownerName: 'Abdul Taiyeb Telwala', phone: '9820033333', playingOwner: 'Abdul Taiyeb (C)', captainSetId: 'set_yaqoot', captainSetName: 'Yaqoot', color: '#ef4444' },
  { id: 'team_04', name: 'Hussaini Strikers', icon: '🏏', username: 'hussaini', password: 'hussaini@2026', ownerName: 'Burhanuddin Husain Rampurawala', phone: '9820044444', playingOwner: 'Burhanuddin (C)', captainSetId: 'set_zumurrud', captainSetName: 'Zumurrud', color: '#10b981' },
  { id: 'team_05', name: 'Bagichawala Blasters', icon: '⚡', username: 'bagichawala', password: 'bagichawala@2026', ownerName: 'Shabbir bagichawala', phone: '9820055555', playingOwner: 'Shabbir (C)', captainSetId: 'set_marjan', captainSetName: 'Marjan', color: '#f59e0b' },
  { id: 'team_06', name: 'Galaxy Titans', icon: '⚔️', username: 'galaxy', password: 'galaxy@2026', ownerName: 'Mustafa akolawala/muffadal hussain', phone: '9820066666', playingOwner: 'Mustafa (C)', captainSetId: 'set_pukhraj', captainSetName: 'Pukhraj', color: '#6366f1' },
  { id: 'team_07', name: 'Ezzy Stars', icon: '⭐', username: 'ezzy', password: 'ezzy@2026', ownerName: 'Murtaza ali jamnagarwala', phone: '9820077777', playingOwner: 'Murtaza (C)', captainSetId: 'set_neelam', captainSetName: 'Neelam', color: '#ec4899' },
  { id: 'team_08', name: 'Supreme Squad', icon: '👑', username: 'supreme', password: 'supreme@2026', ownerName: 'Shabbir murtazapurwala', phone: '9820088888', playingOwner: 'Shabbir (C)', captainSetId: 'set_durenajaf', captainSetName: 'Dur-e-Najaf', color: '#14b8a6' },
  { id: 'team_09', name: 'Raj Strickers', icon: '🥊', username: 'raj', password: 'raj@2026', ownerName: 'Ali chandurwala', phone: '9820099999', playingOwner: 'Ali (C)', captainSetId: 'set_aqeeq', captainSetName: 'Aqeeq', color: '#eab308' },
  { id: 'team_10', name: 'Burhanpurwala Dominators', icon: '🏆', username: 'burhanpur', password: 'burhanpur@2026', ownerName: 'Zoeb Chappalwala', phone: '9820010101', playingOwner: 'Zoeb (C)', captainSetId: 'set_firoza', captainSetName: 'Firoza', color: '#06b6d4' },
  { id: 'team_11', name: 'Choudhary Thunderbolts', icon: '🏹', username: 'choudhary', password: 'choudhary@2026', ownerName: 'Altaf chaudhary', phone: '9820020202', playingOwner: 'Altaf (C)', captainSetId: 'set_yaqoot', captainSetName: 'Yaqoot', color: '#f97316' },
  { id: 'team_12', name: 'Lucky Legends', icon: '🐎', username: 'lucky', password: 'lucky@2026', ownerName: 'Mustufa Bhai Chandurwala', phone: '9820030303', playingOwner: 'Mustufa (C)', captainSetId: 'set_zumurrud', captainSetName: 'Zumurrud', color: '#84cc16' }
];

const FIRST_NAMES = [
  'Husain', 'Ali Asger', 'Taha', 'Burhanuddin', 'Mustafa', 'Abbas', 'Taher', 'Murtaza',
  'Shabbir', 'Huzefa', 'Zainuddin', 'Ibrahim', 'Yusuf', 'Hatira', 'Mansoor', 'Khozema',
  'Kumail', 'Ammar', 'Idris', 'Rashid', 'Farooq', 'Sadiq', 'Qasim', 'Zohair'
];

const LAST_NAMES = [
  'Merchant', 'Kapadia', 'Lokhandwala', 'Bagasrawala', 'Chunawala', 'Gondalwala',
  'Rampuri', 'Badri', 'Godhrawala', 'Attarwala', 'Dahodwala', 'Palanpurwala',
  'Karachiwala', 'Poonawala', 'Surti', 'Bhavnagari', 'Ratlamwala', 'Sidhhpurwala'
];

const BATSMAN_TYPES = [
  'Right-Hand Aggressive',
  'Left-Hand Power Hitter',
  'Right-Hand Anchor',
  'Left-Hand Classical',
  'Right-Hand Finisher',
  'Pinch Hitter'
];

const BOWLER_TYPES = [
  'Right-Arm Medium Fast',
  'Right-Arm Off Spin',
  'Left-Arm Orthodox Spin',
  'Right-Arm Fast Yorker Specialist',
  'Slow Left-Arm Chinaman',
  'Right-Arm Leg Break'
];

const SPECIALIZATIONS = [
  'All-Rounder',
  'Top-Order Batsman',
  'Wicket-Keeper Batsman',
  'Death-Overs Bowler',
  'Bowling All-Rounder',
  'Finisher'
];

function generate96Players() {
  const players = [];
  let count = 1;

  SET_CONFIG.forEach((stoneSet) => {
    for (let i = 1; i <= 12; i++) {
      const fName = FIRST_NAMES[(count * 3 + i * 5) % FIRST_NAMES.length];
      const lName = LAST_NAMES[(count * 7 + i * 2) % LAST_NAMES.length];
      const age = 19 + ((count * 4 + i) % 18);
      const batType = BATSMAN_TYPES[(count + i) % BATSMAN_TYPES.length];
      const bowlType = BOWLER_TYPES[(count * 2 + i) % BOWLER_TYPES.length];
      const spec = SPECIALIZATIONS[(count * 3 + i) % SPECIALIZATIONS.length];

      players.push({
        id: `ply_${String(count).padStart(3, '0')}`,
        name: `${fName} ${lName}`,
        age: age,
        setId: stoneSet.id,
        setName: stoneSet.name,
        batsmanType: batType,
        bowlerType: bowlType,
        specialization: spec,
        basePrice: 1000,
        status: 'AVAILABLE', // 'AVAILABLE' | 'ON_BLOCK' | 'SOLD' | 'UNSOLD'
        soldPrice: null,
        soldToTeamId: null,
        soldToTeamName: null,
        roundNumber: 1,
        autoAssigned: false
      });
      count++;
    }
  });

  return players;
}

window.ALAMDAR_DATA = {
  SET_CONFIG,
  ADMIN_CREDENTIALS,
  INITIAL_TEAMS,
  generate96Players
};
