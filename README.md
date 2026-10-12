# Alamdar Sports Club - Box Cricket Auction PWA

A Progressive Web App (PWA) built for the **Alamdar Company Sports Club Box Cricket Tournament Auction**.

---

## 🏆 Tournament Scale & Constraints

* **12 Teams**: Burhani Blasters, Saifee Strikers, Husaini Hawks, Najmi Knights, Tayyebi Titans, Qutbi Challengers, Badri Royals, Fakhri Fighters, Hakimi Super Kings, Imadi Warriors, Mohammedi Mavericks, Zahra Superstars.
* **Team Composition**: 9 members per team (8 auctioned players + 1 playing Owner/Captain).
* **Budget Purse**: ₹1,00,000 coins per team.
* **Roster Constraint**: Every team **must** acquire exactly 8 players during the auction. The bidding engine strictly reserves funds (`(remaining_slots) * 1,000`) so teams never run out of coins to complete their roster.
* **96 Players in 8 Islamic Stone Sets** (12 players per set):
  1. **Aqeeq** (Carnelian)
  2. **Firoza** (Turquoise)
  3. **Yaqoot** (Ruby)
  4. **Zumurrud** (Emerald)
  5. **Marjan** (Coral)
  6. **Pukhraj** (Yellow Sapphire)
  7. **Neelam** (Blue Sapphire)
  8. **Dur-e-Najaf** (Pearl Quartz)
* **Set Constraint**: A team can purchase a maximum of **1 player per set**.

---

## ⚡ Key Real-Time Mechanics & Rules

1. **Dynamic Increments**:
   * ₹1,000 to ₹10,000: **+₹1,000**
   * ₹10,001 to ₹20,000: **+₹2,000**
   * ₹20,001 to ₹1,00,000: **+₹5,000**
2. **Two-Player Bidding Battle Rule**:
   * Only **TWO** teams can enter the bidding ring for a player at any given time.
   * Other teams see a locked state until one active bidder withdraws.
3. **Auto-Assignment Edge Case Engine**:
   * If only **1 player remains in a set** and only **1 team remains** that has not bought a player from that set, the engine automatically assigns the player to that team at base price (₹1,000).
4. **Single-Active-Session Login Guard**:
   * If a team owner logs in on a new device, previous active sessions are automatically revoked and notified.
5. **Real-time Web Audio Synthesizer**:
   * Authentic bid chimes, battle join tones, hammer strikes, and victory fanfare synthesized via HTML5 Web Audio API.

---

## 🚀 How to Run Locally

You can run this project with any local HTTP server or open directly:

### Option A: Using Python (Installed on your system)
```bash
# In this directory:
python -m http.server 3000
```
Then open your browser at:
`http://localhost:3000`

### Option B: Deploy to GitHub Pages
1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Alamdar Box Cricket Auction PWA"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. In your GitHub repository settings, enable **GitHub Pages** from the `main` branch root (`/`). Your PWA will be live globally!

---

## 📁 Project Structure

```
├── index.html            # Main SPA containing Live Display, Owner View, and Admin Dashboard
├── manifest.json         # PWA Manifest specification
├── sw.js                 # Service worker caching and offline PWA support
├── css/
│   └── style.css         # Glassmorphic dark theme, animations, and responsive styling
├── js/
│   ├── data.js           # 96 players with detailed stats, 12 teams, and 8 stone sets
│   ├── storage.js        # Multi-tab BroadcastChannel & LocalStorage synchronization bus
│   ├── sound.js          # Web Audio API sound synthesizer
│   ├── auction-engine.js # Bidding increments, 2-player rule, auto-assignment, budget reserve logic
│   └── app.js            # Main application orchestrator and view handlers
└── icons/
    ├── icon-192.png      # PWA App icon 192x192
    └── icon-512.png      # PWA App icon 512x512
```
