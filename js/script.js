'use strict';

class BugsfreeTV {
    constructor() {
        this.channels = [];
        this.channelGroups = {};
        this.hls = null;
        this.currentChannel = null;
        this.favorites = new Set();
        this.epgData = [];
        this.uploadHistory = [];
        this.lastPlaylist = null;
        this.uploadedPlaylists = {};
        this.videoPlayer = document.getElementById('videoPlayer');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.notification = document.getElementById('notification');
        this.refreshButton = document.getElementById('refreshButton');
        this.toggleSidebarButton = document.getElementById('toggleSidebarButton');
        this.toggleSidebarIcon = document.getElementById('toggleSidebar');
        this.fullscreenButton = document.getElementById('fullscreenButton');
        this.themeToggle = document.getElementById('themeToggle');
        this.searchInput = document.getElementById('searchInput');
        this.sidebar = document.querySelector('.sidebar');
        this.epgGuide = document.getElementById('epgGuide');
        this.epgProgress = document.getElementById('epgProgress');
        this.videoContainer = document.querySelector('.video-container');
        this.uploadModal = document.getElementById('uploadModal');
        this.fileUpload = document.getElementById('fileUpload');
        this.urlUpload = document.getElementById('urlUpload');
        this.uploadFileButton = document.getElementById('uploadFileButton');
        this.uploadUrlButton = document.getElementById('uploadUrlButton');
        this.clearHistoryButton = document.getElementById('clearHistoryButton');
        this.uploadClose = document.getElementById('uploadClose');
        this.uploadHistoryContainer = document.getElementById('uploadHistory');
        this.playlistStats = document.getElementById('playlistStats');
        this.mainContent = document.querySelector('.main-content');
        this.isUploading = false;
        this.filterStatus = null;
        this.init();
    }

    async init() {
        this.showWelcomeNotification();
        this.setupEventListeners();
        this.loadFavorites();
        this.loadUploadHistory();
        await this.loadLastPlaylist();
        this.displayChannels();
        this.updatePlaylistStats();
        this.updatePlayerSize();
        this.uploadModal.classList.add('show');
        this.registerServiceWorker();
    }

    showWelcomeNotification() {
        const message = `Welcome to BUDDY TV!\nStream your favorite channels effortlessly.\n\nDisclaimer: This app does not host or provide any content. Users must upload their own playlists (M3U/JSON/TXT). We are not responsible for the legality or quality of the content you stream.`;
        this.notification.textContent = message;
        this.notification.classList.add('show');
        setTimeout(() => this.notification.classList.remove('show'), 6000); // Longer duration for reading
    }

    updatePlayerSize() {
        if (this.channels.length === 0 && this.epgData.length === 0) {
            this.sidebar.classList.add('hidden');
            this.epgGuide.classList.remove('visible');
            this.mainContent.classList.add('no-playlist');
        } else {
            this.mainContent.classList.remove('no-playlist');
            this.sidebar.classList.remove('hidden');
        }
    }

    async loadLastPlaylist() {
        const saved = localStorage.getItem('lastPlaylist');
        if (saved) {
            this.lastPlaylist = JSON.parse(saved);
            if (this.lastPlaylist.type === 'url') {
                await this.fetchM3U(this.lastPlaylist.value);
            } else if (this.lastPlaylist.type === 'file' && this.uploadedPlaylists[this.lastPlaylist.value]) {
                this.channels = this.uploadedPlaylists[this.lastPlaylist.value];
                this.displayChannels();
                this.updatePlaylistStats();
                this.updatePlayerSize();
            }
        }
        this.updatePlayerSize();
    }

    async fetchM3U(url) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`M3U fetch failed: ${response.status}`);
            const data = await response.text();
            this.channels = this.removeDuplicates(this.parseM3U(data));
            this.displayChannels();
            this.updatePlaylistStats();
            this.addToUploadHistory(url);
            this.lastPlaylist = { type: 'url', value: url };
            localStorage.setItem('lastPlaylist', JSON.stringify(this.lastPlaylist));
            this.showNotification('Playlist loaded successfully!');
            this.updatePlayerSize();
            return true;
        } catch (error) {
            console.error('M3U fetch failed:', error);
            this.showNotification('Failed to load M3U playlist');
            return false;
        }
    }

    async fetchEPG(url) {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`EPG fetch failed: ${response.status}`);
            const data = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, 'text/xml');
            this.epgData = this.parseEPG(xmlDoc);
            this.channels.forEach(channel => {
                channel.programs = this.epgData.filter(p => p.channel === channel.id);
            });
            if (this.currentChannel) this.updateEPGDisplay(this.currentChannel);
            this.epgGuide.classList.add('visible');
            this.showNotification('EPG loaded successfully!');
        } catch (error) {
            console.warn('EPG loading failed:', error);
            this.showNotification('EPG unavailable');
            this.epgGuide.classList.remove('visible');
        }
    }

    parseM3U(data) {
        const lines = data.split('\n');
        const channels = [];
        let currentChannel = null;

        lines.forEach(line => {
            line = line.trim();
            if (!line) return;

            if (line.startsWith('#EXTINF:')) {
                currentChannel = {
                    duration: parseInt(line.split(',')[0].split(':')[1]) || -1,
                    title: line.split(',').slice(1).join(',').trim().replace(/\(.*?\)/g, '').trim() || 'Untitled',
                    id: '',
                    url: '',
                    group: 'Ungrouped',
                    logo: '',
                    programs: [],
                    status: 'unknown'
                };
                const logoMatch = line.match(/tvg-logo=["'](.*?)["']/i);
                currentChannel.logo = logoMatch ? logoMatch[1] : 'https://buddytv.netlify.app/img/no-logo.png';
            } else if (line.startsWith('#EXTGRP:')) {
                currentChannel.group = line.split(':')[1].trim() || 'Ungrouped';
            } else if (line.startsWith('#EXTTVM:')) {
                currentChannel.id = line.split(':')[1].trim();
            } else if (currentChannel && !line.startsWith('#')) {
                currentChannel.url = line;
                channels.push(currentChannel);
                this.channelGroups[currentChannel.group] = this.channelGroups[currentChannel.group] || [];
                this.channelGroups[currentChannel.group].push(currentChannel);
                currentChannel = null;
            }
        });

        return channels.sort((a, b) => 
            a.group === b.group ? a.title.localeCompare(b.title) : a.group.localeCompare(b.group)
        );
    }

    removeDuplicates(channels) {
        const seen = new Set();
        return channels.filter(channel => {
            const key = `${channel.url}|${channel.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    parseJSON(data) {
        const parsed = JSON.parse(data);
        const channels = parsed.map(item => ({
            title: item.name || item.title || 'Untitled',
            url: item.url || item.stream || '',
            group: item.group || item.category || 'Ungrouped',
            id: item.id || '',
            logo: item.logo || 'https://buddytv.netlify.app/img/no-logo.png',
            programs: [],
            status: 'unknown'
        }));
        return this.removeDuplicates(channels.sort((a, b) => 
            a.group === b.group ? a.title.localeCompare(b.title) : a.group.localeCompare(b.group)
        ));
    }

    parseTXT(data) {
        const lines = data.split('\n').filter(line => line.trim());
        const channels = lines.map((line, index) => ({
            title: `Channel ${index + 1}`,
            url: line.trim(),
            group: 'Imported',
            id: '',
            logo: 'https://buddytv.netlify.app/img/no-logo.png',
            programs: [],
            status: 'unknown'
        }));
        return this.removeDuplicates(channels);
    }

    parseEPG(xmlDoc) {
        const programs = [];
        const programmeElements = xmlDoc.getElementsByTagName('programme');

        for (const prog of Array.from(programmeElements)) {
            const start = new Date(prog.getAttribute('start').replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2}).*/, '$1-$2-$3T$4:$5:$6Z'));
            const stop = new Date(prog.getAttribute('stop').replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2}).*/, '$1-$2-$3T$4:$5:$6Z'));
            programs.push({
                channel: prog.getAttribute('channel'),
                startTime: start,
                endTime: stop,
                title: prog.getElementsByTagName('title')[0]?.textContent || 'Unknown',
                description: prog.getElementsByTagName('desc')[0]?.textContent?.trim() || 'No description',
                category: prog.getElementsByTagName('category')[0]?.textContent?.trim() || 'Uncategorized'
            });
        }
        return programs;
    }

    async checkChannelStatus(channel) {
        return new Promise((resolve) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            fetch(channel.url, { 
                method: 'HEAD', 
                signal: controller.signal, 
                cache: 'no-store',
                mode: 'no-cors'
            })
            .then(response => {
                clearTimeout(timeout);
                channel.status = response.type === 'opaque' ? 'active' : 'offline';
                resolve();
            })
            .catch(() => {
                clearTimeout(timeout);
                channel.status = 'offline';
                resolve();
            });
        });
    }

    async updatePlaylistStats() {
        const total = this.channels.length;
        if (total === 0) {
            this.playlistStats.innerHTML = 'Total: 0 | Active: 0 | Offline: 0';
            return;
        }

        await Promise.all(this.channels.map(channel => this.checkChannelStatus(channel)));
        const active = this.channels.filter(c => c.status === 'active').length;
        const offline = total - active;
        this.playlistStats.innerHTML = `
            <span onclick="document.bugsfreeTV.filterChannels('total')">Total: ${total}</span> | 
            <span onclick="document.bugsfreeTV.filterChannels('active')">Active: ${active}</span> | 
            <span onclick="document.bugsfreeTV.filterChannels('offline')">Offline: ${offline}</span>
        `;
    }

    filterChannels(status) {
        this.filterStatus = status === this.filterStatus ? null : status;
        this.displayChannels(this.searchInput.value);
    }

    displayChannels(query = '') {
        const channelList = document.getElementById('channelList');
        channelList.innerHTML = '';

        if (this.channels.length === 0) {
            channelList.innerHTML = '<p>No channels available. Please upload a playlist.</p>';
            this.sidebar.classList.add('hidden');
            this.updatePlayerSize();
            return;
        }

        let filteredChannels = this.channels.filter(c => 
            c.title.toLowerCase().includes(query.toLowerCase()) || 
            c.group.toLowerCase().includes(query.toLowerCase())
        );

        if (this.filterStatus) {
            filteredChannels = filteredChannels.filter(c => 
                this.filterStatus === 'total' || c.status === this.filterStatus
            );
        }

        if (filteredChannels.length === 0) {
            channelList.innerHTML = '<p>No channels match your search or filter.</p>';
            return;
        }

        const grouped = filteredChannels.reduce((acc, channel) => {
            acc[channel.group] = acc[channel.group] || [];
            acc[channel.group].push(channel);
            return acc;
        }, {});

        const favoriteChannels = filteredChannels.filter(c => this.favorites.has(c.url));
        if (favoriteChannels.length > 0) {
            grouped['Favorites'] = favoriteChannels;
        }

        Object.keys(grouped).sort().forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'channel-group';
            groupDiv.innerHTML = `<h3>${group}</h3>`;

            grouped[group].forEach(channel => {
                const channelDiv = document.createElement('div');
                channelDiv.className = `channel-item ${this.currentChannel?.url === channel.url ? 'active' : ''}`;
                channelDiv.innerHTML = `
                    <div class="channel-info">
                        <img src="${channel.logo}" class="channel-logo" alt="${channel.title} logo" onerror="this.src='https://buddytv.netlify.app/img/no-logo.png'">
                        <span class="channel-title">${channel.title}</span>
                    </div>
                `;
                const favoriteBtn = document.createElement('button');
                favoriteBtn.className = `favorite-btn ${this.favorites.has(channel.url) ? 'favorited' : ''}`;
                favoriteBtn.innerHTML = '★';
                favoriteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleFavorite(channel.url);
                };
                channelDiv.appendChild(favoriteBtn);
                channelDiv.onclick = () => this.playChannel(channel.url);
                groupDiv.appendChild(channelDiv);
            });

            channelList.appendChild(groupDiv);
        });

        this.sidebar.classList.remove('hidden');
        this.updatePlayerSize();
    }

    updateEPGDisplay(channel) {
        if (this.epgData.length === 0) {
            this.epgGuide.classList.remove('visible');
            return;
        }

        const now = new Date();
        const current = channel?.programs?.find(p => now >= p.startTime && now <= p.endTime) || null;
        const next = channel?.programs?.find(p => p.startTime > now) || null;

        document.getElementById('epgCurrent').textContent = current ? 
            `${current.title} - ${current.category}` : 'No current program';
        document.getElementById('epgTime').textContent = current ?
            `${current.startTime.toLocaleTimeString()} - ${current.endTime.toLocaleTimeString()}` : '';
        document.getElementById('epgNext').textContent = next ? 
            `Next: ${next.title} - ${next.category}` : 'No next program';

        if (current) {
            const total = current.endTime - current.startTime;
            const elapsed = now - current.startTime;
            const progress = (elapsed / total) * 100;
            this.epgProgress.style.width = `${Math.min(progress, 100)}%`;
        } else {
            this.epgProgress.style.width = '0%';
        }

        this.epgGuide.classList.add('visible');
    }

    playChannel(url) {
        if (this.currentChannel?.url === url) return;

        this.currentChannel = this.channels.find(c => c.url === url);
        if (!this.currentChannel) {
            this.showNotification('Channel not found');
            return;
        }

        this.updateChannelSelection();
        this.updateEPGDisplay(this.currentChannel);
        this.cleanupPlayer();

        this.loadingIndicator.classList.add('show');
        this.showNotification(`Now Playing: ${this.currentChannel.title}`);

        if (Hls.isSupported() && url.includes('.m3u8')) {
            this.setupHLS(url);
        } else {
            this.setupNative(url);
        }
    }

    setupHLS(url) {
        this.hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 10,
            xhrSetup: (xhr) => {
                xhr.timeout = 10000;
                xhr.withCredentials = false;
            }
        });

        this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            this.hls.loadSource(url);
        });

        this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
            this.videoPlayer.play().catch(e => this.handleError(e, 'Playback failed'));
        });

        this.hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                this.handleError(data, 'Streaming error');
                this.setupNative(url);
            }
        });

        this.hls.attachMedia(this.videoPlayer);
    }

    setupNative(url) {
        this.videoPlayer.src = url;
        this.videoPlayer.play().catch(e => this.handleError(e, 'Native playback failed'));
    }

    cleanupPlayer() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        this.videoPlayer.pause();
        this.videoPlayer.removeAttribute('src');
        this.videoPlayer.load();
    }

    setupEventListeners() {
        this.videoPlayer.addEventListener('playing', () => {
            this.loadingIndicator.classList.remove('show');
        });
        this.videoPlayer.addEventListener('waiting', () => {
            this.loadingIndicator.classList.add('show');
        });
        this.videoPlayer.addEventListener('error', (e) => {
            this.handleError(e, 'Video error');
        });
        this.videoPlayer.addEventListener('stalled', () => {
            this.handleError(null, 'Video stalled');
        });
        this.videoPlayer.addEventListener('timeupdate', () => {
            if (this.currentChannel) this.updateEPGDisplay(this.currentChannel);
        });
        this.refreshButton.addEventListener('click', () => {
            if (this.currentChannel) {
                this.playChannel(this.currentChannel.url);
                this.showNotification('Channel refreshed!');
            }
        });
        this.toggleSidebarButton.addEventListener('click', () => {
            this.uploadModal.classList.add('show');
        });
        this.toggleSidebarIcon.addEventListener('click', () => {
            this.sidebar.classList.add('hidden');
        });
        this.fullscreenButton.addEventListener('click', () => this.toggleFullscreen());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.searchInput.addEventListener('input', (e) => this.displayChannels(e.target.value));
        this.uploadFileButton.addEventListener('click', () => this.handleFileUpload());
        this.uploadUrlButton.addEventListener('click', () => this.handleUrlUpload());
        this.clearHistoryButton.addEventListener('click', () => this.clearHistory());
        this.uploadClose.addEventListener('click', () => {
            this.uploadModal.classList.remove('show');
            this.updatePlayerSize();
        });
        this.uploadModal.addEventListener('click', (e) => {
            if (e.target === this.uploadModal) {
                this.uploadModal.classList.remove('show');
                this.updatePlayerSize();
            }
        });
        this.fileUpload.addEventListener('change', () => {
            if (this.fileUpload.files.length > 0) this.handleFileUpload();
        });
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.videoContainer.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    toggleTheme() {
        document.body.classList.toggle('dark');
        this.themeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
        localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    }

    toggleFavorite(url) {
        if (this.favorites.has(url)) {
            this.favorites.delete(url);
        } else {
            this.favorites.add(url);
        }
        localStorage.setItem('favorites', JSON.stringify([...this.favorites]));
        this.displayChannels(this.searchInput.value);
    }

    loadFavorites() {
        const saved = localStorage.getItem('favorites');
        if (saved) this.favorites = new Set(JSON.parse(saved));
        const theme = localStorage.getItem('theme');
        if (theme === 'dark') {
            document.body.classList.add('dark');
            this.themeToggle.textContent = '☀️';
        }
    }

    loadUploadHistory() {
        const savedHistory = localStorage.getItem('uploadHistory');
        const savedPlaylists = localStorage.getItem('uploadedPlaylists');
        if (savedHistory) this.uploadHistory = JSON.parse(savedHistory);
        if (savedPlaylists) this.uploadedPlaylists = JSON.parse(savedPlaylists);
        this.displayUploadHistory();
    }

    addToUploadHistory(entry, channels = null) {
        const entryStr = `${new Date().toLocaleString()} - ${entry}`;
        if (!this.uploadHistory.some(item => item.includes(entry))) {
            this.uploadHistory.unshift(entryStr);
            if (this.uploadHistory.length > 5) this.uploadHistory.pop();
            if (channels) this.uploadedPlaylists[entry] = channels;
            localStorage.setItem('uploadHistory', JSON.stringify(this.uploadHistory));
            localStorage.setItem('uploadedPlaylists', JSON.stringify(this.uploadedPlaylists));
            this.displayUploadHistory();
        }
    }

    displayUploadHistory() {
        this.uploadHistoryContainer.innerHTML = this.uploadHistory.map(item => {
            const [time, entry] = item.split(' - ');
            return `<div class="upload-history-item" onclick="document.bugsfreeTV.loadFromHistory('${entry}')">${item}</div>`;
        }).join('');
    }

    async loadFromHistory(entry) {
        this.showNotification(`Loading ${entry}...`);
        if (entry.match(/^https?:\/\/.+/)) {
            await this.fetchM3U(entry);
            this.uploadModal.classList.remove('show');
            if (this.channels.length > 0) this.playChannel(this.channels[0].url);
        } else if (this.uploadedPlaylists[entry]) {
            this.channels = this.uploadedPlaylists[entry];
            this.displayChannels();
            this.updatePlaylistStats();
            this.lastPlaylist = { type: 'file', value: entry };
            localStorage.setItem('lastPlaylist', JSON.stringify(this.lastPlaylist));
            this.uploadModal.classList.remove('show');
            this.showNotification(`Loaded ${entry} from history!`);
            if (this.channels.length > 0) this.playChannel(this.channels[0].url);
        } else {
            this.showNotification('Playlist data not found. Please re-upload the file.');
            this.fileUpload.value = '';
            this.fileUpload.click();
        }
    }

    async handleFileUpload() {
        if (this.isUploading) return;
        const file = this.fileUpload.files[0];
        if (!file) return this.showNotification('Please select a file');

        this.isUploading = true;
        this.uploadFileButton.disabled = true;
        this.showNotification('Uploading file...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = e.target.result;
            if (file.name.endsWith('.m3u')) {
                this.channels = this.removeDuplicates(this.parseM3U(data));
            } else if (file.name.endsWith('.json')) {
                this.channels = this.removeDuplicates(this.parseJSON(data));
            } else if (file.name.endsWith('.txt')) {
                this.channels = this.removeDuplicates(this.parseTXT(data));
            } else {
                this.showNotification('Unsupported file format');
                this.isUploading = false;
                this.uploadFileButton.disabled = false;
                return;
            }
            this.displayChannels();
            this.updatePlaylistStats();
            this.addToUploadHistory(file.name, this.channels);
            this.lastPlaylist = { type: 'file', value: file.name };
            localStorage.setItem('lastPlaylist', JSON.stringify(this.lastPlaylist));
            this.uploadModal.classList.remove('show');
            this.showNotification('File uploaded successfully!');
            if (this.channels.length > 0) this.playChannel(this.channels[0].url);
            this.isUploading = false;
            this.uploadFileButton.disabled = false;
        };
        reader.onerror = () => {
            this.showNotification('Failed to read file');
            this.isUploading = false;
            this.uploadFileButton.disabled = false;
        };
        reader.readAsText(file);
    }

    async handleUrlUpload() {
        if (this.isUploading) return;
        const url = this.urlUpload.value.trim();
        if (!url) return this.showNotification('Please enter a URL');
        if (!url.match(/^https?:\/\/.+/)) return this.showNotification('Invalid URL format');

        this.isUploading = true;
        this.uploadUrlButton.disabled = true;
        this.showNotification('Loading URL...');

        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            const data = await response.text();
            if (url.endsWith('.m3u')) {
                this.channels = this.removeDuplicates(this.parseM3U(data));
            } else if (url.endsWith('.json')) {
                this.channels = this.removeDuplicates(this.parseJSON(data));
            } else if (url.endsWith('.txt')) {
                this.channels = this.removeDuplicates(this.parseTXT(data));
            } else {
                this.showNotification('Unsupported URL format');
                this.isUploading = false;
                this.uploadUrlButton.disabled = false;
                return;
            }
            this.displayChannels();
            this.updatePlaylistStats();
            this.addToUploadHistory(url);
            this.lastPlaylist = { type: 'url', value: url };
            localStorage.setItem('lastPlaylist', JSON.stringify(this.lastPlaylist));
            this.uploadModal.classList.remove('show');
            this.showNotification('URL loaded successfully!');
            if (this.channels.length > 0) this.playChannel(this.channels[0].url);
        } catch (error) {
            console.error('URL upload failed:', error);
            this.showNotification('Failed to load URL');
        } finally {
            this.isUploading = false;
            this.uploadUrlButton.disabled = false;
        }
    }

    clearHistory() {
        this.channels = [];
        this.channelGroups = {};
        this.currentChannel = null;
        this.epgData = [];
        this.favorites.clear();
        this.uploadHistory = [];
        this.lastPlaylist = null;
        this.uploadedPlaylists = {};
        this.filterStatus = null;
        localStorage.removeItem('favorites');
        localStorage.removeItem('uploadHistory');
        localStorage.removeItem('lastPlaylist');
        localStorage.removeItem('uploadedPlaylists');
        this.displayChannels();
        this.updatePlaylistStats();
        this.displayUploadHistory();
        this.cleanupPlayer();
        this.updateEPGDisplay({ programs: [] });
        this.showNotification('History cleared!');
        this.updatePlayerSize();
    }

    updateChannelSelection() {
        this.displayChannels(this.searchInput.value);
    }

    handleError(error, message) {
        console.error(`${message}:`, error);
        this.loadingIndicator.classList.remove('show');
        this.showNotification(`${message}. Try another channel.`);
    }

    showNotification(message) {
        this.notification.textContent = message;
        this.notification.classList.add('show');
        setTimeout(() => this.notification.classList.remove('show'), 3000);
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(reg => console.log('Service Worker registered:', reg))
                    .catch(err => console.error('Service Worker registration failed:', err));
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.bugsfreeTV = new BugsfreeTV();
});