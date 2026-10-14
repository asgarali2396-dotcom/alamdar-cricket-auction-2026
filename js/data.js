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

// 12 Teams with Individual Credentials
const INITIAL_TEAMS = [
  { id: 'team_01', name: 'Burhani Blasters', icon: '⚡', username: 'burhani', password: 'burhani@2026', ownerName: 'Murtaza Bhai', phone: '9820011111', playingOwner: 'Murtaza (C)', color: '#3b82f6' },
  { id: 'team_02', name: 'Saifee Strikers', icon: '🏏', username: 'saifee', password: 'saifee@2026', ownerName: 'Mustafa Bhai', phone: '9820022222', playingOwner: 'Mustafa (C)', color: '#10b981' },
  { id: 'team_03', name: 'Husaini Hawks', icon: '🦅', username: 'husaini', password: 'husaini@2026', ownerName: 'Shabbir Bhai', phone: '9820033333', playingOwner: 'Shabbir (C)', color: '#f59e0b' },
  { id: 'team_04', name: 'Najmi Knights', icon: '🛡️', username: 'najmi', password: 'najmi@2026', ownerName: 'Ali Asgar Bhai', phone: '9820044444', playingOwner: 'Ali Asgar (C)', color: '#ef4444' },
  { id: 'team_05', name: 'Tayyebi Titans', icon: '⚔️', username: 'tayyebi', password: 'tayyebi@2026', ownerName: 'Huzefa Bhai', phone: '9820055555', playingOwner: 'Huzefa (C)', color: '#8b5cf6' },
  { id: 'team_06', name: 'Qutbi Challengers', icon: '🦁', username: 'qutbi', password: 'qutbi@2026', ownerName: 'Taha Bhai', phone: '9820066666', playingOwner: 'Taha (C)', color: '#ec4899' },
  { id: 'team_07', name: 'Badri Royals', icon: '👑', username: 'badri', password: 'badri@2026', ownerName: 'Abbas Bhai', phone: '9820077777', playingOwner: 'Abbas (C)', color: '#14b8a6' },
  { id: 'team_08', name: 'Fakhri Fighters', icon: '🥊', username: 'fakhri', password: 'fakhri@2026', ownerName: 'Zainuddin Bhai', phone: '9820088888', playingOwner: 'Zainuddin (C)', color: '#6366f1' },
  { id: 'team_09', name: 'Hakimi Super Kings', icon: '🏆', username: 'hakimi', password: 'hakimi@2026', ownerName: 'Mohammed Bhai', phone: '9820099999', playingOwner: 'Mohammed (C)', color: '#eab308' },
  { id: 'team_10', name: 'Imadi Warriors', icon: '🏹', username: 'imadi', password: 'imadi@2026', ownerName: 'Adnan Bhai', phone: '9820010101', playingOwner: 'Adnan (C)', color: '#06b6d4' },
  { id: 'team_11', name: 'Mohammedi Mavericks', icon: '🐎', username: 'mohammedi', password: 'mohammedi@2026', ownerName: 'Ibrahim Bhai', phone: '9820020202', playingOwner: 'Ibrahim (C)', color: '#f97316' },
  { id: 'team_12', name: 'Zahra Superstars', icon: '⭐', username: 'zahra', password: 'zahra@2026', ownerName: 'Burhanuddin Bhai', phone: '9820030303', playingOwner: 'Burhanuddin (C)', color: '#84cc16' }
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
