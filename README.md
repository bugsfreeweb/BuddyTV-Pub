# BUDDY TV - Professional Streaming App

![BUDDY TV Logo](https://buddytv.netlify.app/img/logo.png)

BUDDY TV is a Progressive Web App (PWA) designed to stream your favorite TV channels using custom playlists in M3U, JSON, or TXT formats. With a sleek, responsive UI, dark/light theme support, and features like EPG display and channel filtering, it offers a professional streaming experience directly from your browser or as an installable app.

---

## Features

- **Playlist Support**: Upload M3U, JSON, or TXT playlists via file or URL.
- **Channel Management**:
  - Automatic duplicate removal based on URL and title.
  - Filter channels by status (Total, Active, Offline) with clickable stats.
  - Search channels by name or group.
  - Favorite channels with persistent storage.
- **Streaming**: Supports HLS (`.m3u8`) via `hls.js` and native playback for other formats.
- **EPG**: Displays current and next programs with a progress bar (requires EPG data).
- **UI/UX**:
  - Responsive design with a collapsible sidebar.
  - Light and dark themes with toggle.
  - Fullscreen video mode.
  - Custom logo in the header.
- **PWA**: Installable on desktop/mobile, with offline caching for core assets.
- **Local Storage**: Persists favorites, upload history, and last playlist.
- **Notifications**: Welcome message with disclaimer, plus status updates.

---

## Screenshots

![Main Interface](./screenshots/entry.png?text=Main+Interface)
![Player Light](./screenshots/player-light.png?text=Player+Light)
![Player dark](./screenshots/player-dark.png?text=Player+Dark)

---

## Prerequisites

- A modern web browser (Chrome, Firefox, Safari, etc.).
- HTTPS hosting for PWA features (e.g., GitHub Pages, Netlify).
- A valid M3U, JSON, or TXT playlist file/URL.

---

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/bugsfreeweb/BuddyTV-Pub.git
   cd BuddyTV-Pub
---
### Notes for Customization:
1. **Replace Placeholders**:
   - Update `your-username` in the clone URL with your GitHub username.
   - Replace screenshot placeholders with actual images (e.g., upload to GitHub or an image host).
   - Add your name in the Acknowledgments section.

2. **Screenshots**:
   - Take screenshots of the app (main interface, upload modal, etc.) and upload them to the repo or a hosting service like Imgur.

3. **License**:
   - If you want a license, create a `LICENSE` file (e.g., MIT License text) and link it in the README.

4. **Hosting**:
   - Mention your deployed URL (e.g., `https://your_user_name.github.io/BuddyTV-Pub`) if applicable.

---

### How to Add to GitHub:
1. Create a new repository on GitHub (e.g., `BuddyTV-Pub`).
2. Initialize locally:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/bugsfreeweb/BuddyTV-Pub.git
   git push -u origin main

## Dependencies
- HLS.js (v1.5.13) - Loaded via CDN for HLS streaming.
- Google Fonts (Inter, Playfair Display) - For typography.
- No additional installations are required beyond the included files.

## Development
# To customize or extend BUDDY TV:
- Edit Styles: Modify styles.css for UI changes.
- Add Features: Update script.js (e.g., new playlist formats, UI enhancements).
- Test Locally: Use a local server and browser DevTools.
## Disclaimer
BUDDY TV does not host or provide any content. Users must supply their own playlists. The developers are not responsible for the legality, quality, or availability of the streamed content. Use responsibly and ensure compliance with local laws.

## Contributing
- Fork the repository.
- Create a feature branch (git checkout -b feature-name).
- Commit changes (git commit -m "Add feature").
- Push to the branch (git push origin feature-name).
- Open a Pull Request.
## License
This project is licensed under the MIT License - see the  file for details.
