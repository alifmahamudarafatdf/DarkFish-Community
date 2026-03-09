   lucide.createIcons();
        
        // Global variables
        let isDark = true;
        let myData = {
            id: '',
            name: '',
            avatar: 'avatar.png'
        };
        let friends = [];
        let filteredFriends = [];
        let peer = null;
        let currentConnections = {};
        let activeFriend = null;
        let generatedId = '';
        
        // Voice recording variables
        let mediaRecorder = null;
        let audioChunks = [];
        let recordingInterval = null;
        let recordingSeconds = 0;
        let isRecording = false;

        // Toast timeout variable
        let toastTimeout = null;

        // Show toast notification - auto hides after 2 seconds with animation
        function showToast(message, type = 'info', duration = 2000) {
            const toast = document.getElementById('toast');
            const toastMessage = document.getElementById('toast-message');
            
            // Clear any existing timeout
            if (toastTimeout) {
                clearTimeout(toastTimeout);
                toastTimeout = null;
            }
            
            // Hide any existing toast with animation
            if (toast.classList.contains('show')) {
                toast.classList.remove('show');
                toast.classList.add('hide');
                
                // Wait for hide animation to complete before showing new one
                setTimeout(() => {
                    showNewToast(message, type, duration);
                }, 300);
            } else {
                showNewToast(message, type, duration);
            }
        }

        function showNewToast(message, type, duration) {
            const toast = document.getElementById('toast');
            const toastMessage = document.getElementById('toast-message');
            
            // Remove hide class and update content
            toast.classList.remove('hide', 'show');
            toast.className = `toast ${type}`;
            toastMessage.textContent = message;
            toast.classList.remove('hidden');
            
            // Update icon based on type
            const icon = toast.querySelector('i');
            if (type === 'success') icon.setAttribute('data-lucide', 'check-circle');
            else if (type === 'error') icon.setAttribute('data-lucide', 'alert-circle');
            else icon.setAttribute('data-lucide', 'info');
            
            lucide.createIcons();
            
            // Show toast with animation
            setTimeout(() => {
                toast.classList.add('show');
            }, 10);
            
            // Set timeout to hide after duration
            toastTimeout = setTimeout(() => {
                toast.classList.remove('show');
                toast.classList.add('hide');
                
                // Hide completely after animation
                setTimeout(() => {
                    toast.classList.add('hidden');
                    toast.classList.remove('hide');
                    toastTimeout = null;
                }, 300);
            }, duration);
        }

        // Initialize PeerJS
        function initPeer(id) {
            if (peer) peer.destroy();
            
            peer = new Peer(id, {
                debug: 2
            });

            peer.on('open', () => {
                console.log('Peer connected with ID:', peer.id);
                document.getElementById('connection-status').classList.remove('hidden');
                myData.id = peer.id;
                updateMyIdDisplay();
                checkExistingFriends();
                showToast('Connected to network!', 'success');
            });

            peer.on('connection', (conn) => {
                conn.on('open', () => {
                    console.log('Incoming connection from:', conn.peer);
                    
                    // Send our profile to the new friend
                    conn.send({
                        type: 'profile',
                        data: {
                            name: myData.name,
                            avatar: myData.avatar,
                            id: myData.id
                        }
                    });

                    // Store connection
                    currentConnections[conn.peer] = conn;
                    
                    // Check if this friend exists, if not add them
                    const existingFriend = friends.find(f => f.id === conn.peer);
                    if (!existingFriend) {
                        // Wait for their profile
                        conn.on('data', (data) => {
                            if (data.type === 'profile') {
                                const newFriend = {
                                    id: conn.peer,
                                    name: data.data.name,
                                    avatar: data.data.avatar,
                                    conn: conn
                                };
                                friends.push(newFriend);
                                filteredFriends = [...friends];
                                renderContacts();
                                updateConnectionStatus(conn.peer, true);
                                showToast(`New friend connected: ${data.data.name}`, 'success');
                            } else if (data.type === 'profile_update') {
                                updateFriendProfile(conn.peer, data.data);
                            } else if (data.type === 'message') {
                                receiveMessage(conn.peer, data.data);
                            } else if (data.type === 'voice') {
                                receiveVoiceMessage(conn.peer, data.data);
                            }
                        });
                    } else {
                        existingFriend.conn = conn;
                        updateConnectionStatus(conn.peer, true);
                        showToast(`${existingFriend.name} is online`, 'success');
                        
                        conn.on('data', (data) => {
                            if (data.type === 'profile_update') {
                                updateFriendProfile(conn.peer, data.data);
                            } else if (data.type === 'message') {
                                receiveMessage(conn.peer, data.data);
                            } else if (data.type === 'voice') {
                                receiveVoiceMessage(conn.peer, data.data);
                            }
                        });
                    }
                });
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (err.type === 'unavailable-id') {
                    showToast('This ID is already taken. Please try another one.', 'error');
                    showIdOptions();
                }
            });
        }

        // Generate random ID
        function generateRandomId() {
            const adjectives = ['cool', 'happy', 'smart', 'wild', 'calm', 'bold', 'kind', 'nice'];
            const nouns = ['fish', 'cat', 'dog', 'bird', 'lion', 'wolf', 'bear', 'fox'];
            const num = Math.floor(Math.random() * 1000);
            return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${num}`;
        }

        function regenerateId() {
            generatedId = generateRandomId();
            document.getElementById('generated-id').textContent = generatedId;
        }

        function copyId() {
            navigator.clipboard.writeText(generatedId);
            showToast('ID copied to clipboard!', 'success');
        }

        function copyMyId() {
            navigator.clipboard.writeText(myData.id);
            showToast('Your ID copied to clipboard!', 'success');
        }

        function useCustomId() {
            document.getElementById('id-modal').classList.add('hidden');
            document.getElementById('custom-id-modal').classList.remove('hidden');
        }

        function closeCustomIdModal() {
            document.getElementById('custom-id-modal').classList.add('hidden');
            document.getElementById('id-modal').classList.remove('hidden');
        }

        function setCustomId() {
            const customId = document.getElementById('custom-id-input').value.trim();
            if (!customId) return;
            generatedId = customId;
            document.getElementById('generated-id').textContent = customId;
            document.getElementById('custom-id-modal').classList.add('hidden');
            document.getElementById('id-modal').classList.remove('hidden');
        }

        function showIdOptions() {
            const name = document.getElementById('setup-name').value.trim();
            if (!name) {
                showToast('Please enter your name', 'error');
                return;
            }
            
            // Add loading animation
            const btn = document.getElementById('continue-btn');
            btn.classList.add('btn-loading');
            
            setTimeout(() => {
                myData.name = name;
                document.getElementById('setup-modal').style.display = 'none';
                
                generatedId = generateRandomId();
                document.getElementById('generated-id').textContent = generatedId;
                document.getElementById('id-modal').classList.remove('hidden');
                btn.classList.remove('btn-loading');
            }, 500);
        }

        function enterMessenger() {
            const btn = document.getElementById('enter-chat-btn');
            btn.classList.add('btn-loading');
            
            setTimeout(() => {
                document.getElementById('id-modal').classList.add('hidden');
                
                // Initialize Peer with selected ID
                initPeer(generatedId);
                
                // Update UI
                document.getElementById('my-name-display').innerText = myData.name;
                document.getElementById('sidebar-avatar').src = myData.avatar;
                updateMyIdDisplay();
                
                btn.classList.remove('btn-loading');
                lucide.createIcons();
            }, 500);
        }

        function updateMyIdDisplay() {
            document.getElementById('my-id-display').innerText = `@${myData.id}`;
        }

        function previewSetupAvatar(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    myData.avatar = e.target.result;
                    document.getElementById('setup-avatar-preview').src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }

        function openProfileModal() {
            document.getElementById('profile-name-input').value = myData.name;
            document.getElementById('profile-avatar-preview').src = myData.avatar;
            document.getElementById('profile-modal').classList.remove('hidden');
            lucide.createIcons();
        }

        function closeProfileModal() {
            document.getElementById('profile-modal').classList.add('hidden');
        }

        function previewProfileAvatar(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('profile-avatar-preview').src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }

        function saveProfile() {
            const newName = document.getElementById('profile-name-input').value.trim();
            const newAvatar = document.getElementById('profile-avatar-preview').src;
            
            if (newName) {
                myData.name = newName;
                myData.avatar = newAvatar;
                
                // Update UI
                document.getElementById('my-name-display').innerText = myData.name;
                document.getElementById('sidebar-avatar').src = myData.avatar;
                
                // Broadcast profile update to all connected friends
                Object.values(currentConnections).forEach(conn => {
                    if (conn.open) {
                        conn.send({
                            type: 'profile_update',
                            data: {
                                name: myData.name,
                                avatar: myData.avatar
                            }
                        });
                    }
                });
                
                showToast('Profile updated successfully!', 'success');
                closeProfileModal();
            }
        }

        function updateFriendProfile(friendId, profileData) {
            const friend = friends.find(f => f.id === friendId);
            if (friend) {
                friend.name = profileData.name;
                friend.avatar = profileData.avatar;
                filteredFriends = [...friends];
                renderContacts();
                
                // If this is the active chat, update the header
                if (activeFriend && activeFriend.id === friendId) {
                    document.getElementById('active-name').innerText = friend.name;
                    document.getElementById('active-avatar').innerHTML = `<img src="${friend.avatar}" class="w-full h-full object-cover">`;
                }
                
                showToast(`${friend.name} updated their profile`, 'info');
            }
        }

        function updateConnectionStatus(friendId, isOnline) {
            const friend = friends.find(f => f.id === friendId);
            if (friend) {
                if (activeFriend && activeFriend.id === friendId) {
                    document.getElementById('active-status').innerText = isOnline ? 'Connected' : 'Disconnected';
                    document.getElementById('active-status').className = isOnline ? 'text-[9px] md:text-[10px] text-green-500 font-bold uppercase tracking-widest' : 'text-[9px] md:text-[10px] text-yellow-500 font-bold uppercase tracking-widest';
                    document.getElementById('send-trigger').disabled = !isOnline;
                }
                renderContacts();
            }
        }

        function logout() {
            if (peer) peer.destroy();
            location.reload();
        }

        function openAdd() {
            document.getElementById('add-modal').classList.remove('hidden');
        }

        function closeAdd() {
            document.getElementById('add-modal').classList.add('hidden');
            document.getElementById('friend-id-input').value = '';
        }

        function connectToFriend() {
            const friendId = document.getElementById('friend-id-input').value.trim();
            if (!friendId) return;
            
            if (friendId === myData.id) {
                showToast("You can't connect to yourself!", 'error');
                return;
            }
            
            // Check if already connected
            if (currentConnections[friendId]) {
                showToast('Already connected to this friend!', 'info');
                closeAdd();
                return;
            }
            
            const btn = document.getElementById('connect-btn');
            btn.classList.add('btn-loading');
            
            // Create connection
            const conn = peer.connect(friendId);
            
            conn.on('open', () => {
                console.log('Connected to:', friendId);
                
                // Send our profile
                conn.send({
                    type: 'profile',
                    data: {
                        name: myData.name,
                        avatar: myData.avatar,
                        id: myData.id
                    }
                });
                
                // Store connection
                currentConnections[friendId] = conn;
                
                // Add to friends list (will get profile in response)
                conn.on('data', (data) => {
                    if (data.type === 'profile') {
                        const newFriend = {
                            id: friendId,
                            name: data.data.name,
                            avatar: data.data.avatar,
                            conn: conn
                        };
                        
                        // Check if already exists
                        const existingIndex = friends.findIndex(f => f.id === friendId);
                        if (existingIndex === -1) {
                            friends.push(newFriend);
                        } else {
                            friends[existingIndex] = newFriend;
                        }
                        
                        filteredFriends = [...friends];
                        renderContacts();
                        updateConnectionStatus(friendId, true);
                        showToast(`Connected to ${data.data.name}!`, 'success');
                        
                    } else if (data.type === 'profile_update') {
                        updateFriendProfile(friendId, data.data);
                    } else if (data.type === 'message') {
                        receiveMessage(friendId, data.data);
                    } else if (data.type === 'voice') {
                        receiveVoiceMessage(friendId, data.data);
                    }
                });
                
                btn.classList.remove('btn-loading');
                closeAdd();
            });
            
            conn.on('error', (err) => {
                console.error('Connection error:', err);
                showToast('Failed to connect. Make sure the ID is correct and the user is online.', 'error');
                btn.classList.remove('btn-loading');
            });
        }

        function searchFriends() {
            const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
            
            if (searchTerm === '') {
                filteredFriends = [...friends];
            } else {
                filteredFriends = friends.filter(friend => 
                    friend.name.toLowerCase().includes(searchTerm) || 
                    friend.id.toLowerCase().includes(searchTerm)
                );
            }
            
            renderContacts();
            
            // Highlight search input
            const searchInput = document.getElementById('search-input');
            searchInput.classList.add('search-highlight');
            setTimeout(() => searchInput.classList.remove('search-highlight'), 300);
        }

        function renderContacts() {
            const list = document.getElementById('contact-list');
            list.innerHTML = '';
            
            if (filteredFriends.length === 0) {
                if (friends.length === 0) {
                    list.innerHTML = '<div class="p-8 text-center opacity-30"><i data-lucide="message-square" class="mx-auto w-10 h-10 mb-2"></i><p class="text-xs">No friends yet. Add someone to chat!</p></div>';
                } else {
                    list.innerHTML = '<div class="p-8 text-center opacity-30"><i data-lucide="search-x" class="mx-auto w-10 h-10 mb-2"></i><p class="text-xs">No matching friends found</p></div>';
                }
                lucide.createIcons();
                return;
            }
            
            filteredFriends.forEach(f => {
                const item = document.createElement('div');
                item.className = "flex items-center gap-4 p-4 rounded-2xl cursor-pointer hover:bg-indigo-600/5 transition transform hover:scale-105";
                item.onclick = () => loadChat(f);
                
                const isOnline = currentConnections[f.id] && currentConnections[f.id].open;
                
                item.innerHTML = `
                    <div class="relative">
                        <img src="${f.avatar}" class="w-12 h-12 rounded-2xl bg-slate-800 border border-white/5 object-cover">
                        <div class="absolute -bottom-1 -right-1 w-4 h-4 ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'} border-4 border-[var(--sidebar-bg)] rounded-full"></div>
                    </div>
                    <div class="flex-1 overflow-hidden">
                        <div class="flex justify-between items-center">
                            <h4 class="font-black text-sm truncate">${f.name}</h4>
                            <span class="text-[8px] text-slate-500 font-bold">${isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                        <p class="text-[10px] text-indigo-400 font-bold tracking-widest uppercase truncate">@${f.id}</p>
                    </div>
                `;
                list.appendChild(item);
            });
            lucide.createIcons();
        }

        function loadChat(friend) {
            activeFriend = friend;
            
            document.getElementById('landing-view').classList.add('hidden');
            document.getElementById('active-name').innerText = friend.name;
            document.getElementById('active-avatar').innerHTML = `<img src="${friend.avatar}" class="w-full h-full object-cover">`;
            
            const isOnline = currentConnections[friend.id] && currentConnections[friend.id].open;
            document.getElementById('active-status').innerText = isOnline ? 'Connected' : 'Disconnected';
            document.getElementById('active-status').className = isOnline ? 'text-[9px] md:text-[10px] text-green-500 font-bold uppercase tracking-widest' : 'text-[9px] md:text-[10px] text-yellow-500 font-bold uppercase tracking-widest';
            
            // Enable/disable send button based on connection
            document.getElementById('send-trigger').disabled = !isOnline;
            
            // Load chat history
            document.getElementById('message-flow').innerHTML = '';
            
            if (window.innerWidth < 768) {
                document.getElementById('sidebar').classList.add('mobile-hidden');
                const chatArea = document.getElementById('chat-area');
                chatArea.classList.remove('mobile-hidden');
                chatArea.classList.add('active');
            }
            
            lucide.createIcons();
        }

        function receiveMessage(friendId, message) {
            if (!activeFriend || activeFriend.id !== friendId) return;
            
            const html = `
                <div class="flex flex-col items-start gap-1 message-fade-in">
                    <div class="msg-bubble msg-received shadow-lg">${message}</div>
                    <span class="text-[8px] text-slate-500 font-bold uppercase ml-2">Received</span>
                </div>
            `;
            
            document.getElementById('message-flow').insertAdjacentHTML('beforeend', html);
            document.getElementById('message-flow').scrollTop = document.getElementById('message-flow').scrollHeight;
        }

        function sendMessage() {
            const input = document.getElementById('main-input');
            const txt = input.value.trim();
            
            if (!txt || !activeFriend || !currentConnections[activeFriend.id] || !currentConnections[activeFriend.id].open) {
                showToast('Not connected to friend', 'error');
                return;
            }
            
            // Send message
            currentConnections[activeFriend.id].send({
                type: 'message',
                data: txt
            });
            
            // Add to UI - removed slide animation, only fade
            const html = `
                <div class="flex flex-col items-end gap-1 message-fade-in">
                    <div class="msg-bubble msg-sent shadow-lg shadow-indigo-600/20">${txt}</div>
                    <span class="text-[8px] text-slate-500 font-bold uppercase mr-2">Sent</span>
                </div>
            `;
            
            document.getElementById('message-flow').insertAdjacentHTML('beforeend', html);
            input.value = '';
            input.style.height = 'auto';
            document.getElementById('message-flow').scrollTop = document.getElementById('message-flow').scrollHeight;
        }

        // Voice Message Functions
        function toggleVoiceRecorder() {
            if (!activeFriend || !currentConnections[activeFriend.id] || !currentConnections[activeFriend.id].open) {
                showToast('Connect to a friend first', 'error');
                return;
            }
            
            const recorder = document.getElementById('voice-recorder');
            recorder.classList.toggle('active');
            
            if (recorder.classList.contains('active')) {
                startRecording();
            } else {
                stopRecording();
            }
        }

        async function startRecording() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                
                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };
                
                mediaRecorder.onstop = () => {
                    stream.getTracks().forEach(track => track.stop());
                };
                
                mediaRecorder.start();
                isRecording = true;
                
                // Start timer
                recordingSeconds = 0;
                recordingInterval = setInterval(() => {
                    recordingSeconds++;
                    const minutes = Math.floor(recordingSeconds / 60);
                    const seconds = recordingSeconds % 60;
                    document.getElementById('recording-timer').textContent = 
                        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }, 1000);
                
                showToast('Recording started...', 'info');
                
            } catch (err) {
                console.error('Error accessing microphone:', err);
                showToast('Could not access microphone', 'error');
                toggleVoiceRecorder();
            }
        }

        function stopRecording() {
            if (mediaRecorder && isRecording) {
                mediaRecorder.stop();
                isRecording = false;
                clearInterval(recordingInterval);
                document.getElementById('voice-recorder').classList.remove('active');
            }
        }

        function sendVoiceMessage() {
            if (audioChunks.length === 0) return;
            
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            
            reader.onloadend = () => {
                const base64Audio = reader.result.split(',')[1];
                
                // Send voice message
                currentConnections[activeFriend.id].send({
                    type: 'voice',
                    data: base64Audio
                });
                
                // Add to UI - removed slide animation, only fade
                const html = `
                    <div class="flex flex-col items-end gap-1 message-fade-in">
                        <div class="voice-msg shadow-lg shadow-indigo-600/20">
                            <i data-lucide="mic" class="w-4 h-4"></i>
                            <span>Voice message ${Math.floor(recordingSeconds / 60)}:${(recordingSeconds % 60).toString().padStart(2, '0')}</span>
                            <i data-lucide="play" class="w-4 h-4 ml-2 cursor-pointer hover:scale-110 transition" onclick="playVoiceMessage(this, '${base64Audio}')"></i>
                        </div>
                        <span class="text-[8px] text-slate-500 font-bold uppercase mr-2">Sent</span>
                    </div>
                `;
                
                document.getElementById('message-flow').insertAdjacentHTML('beforeend', html);
                document.getElementById('message-flow').scrollTop = document.getElementById('message-flow').scrollHeight;
                
                stopRecording();
                lucide.createIcons();
                showToast('Voice message sent!', 'success');
            };
            
            reader.readAsDataURL(audioBlob);
        }

        function receiveVoiceMessage(friendId, audioData) {
            if (!activeFriend || activeFriend.id !== friendId) return;
            
            const html = `
                <div class="flex flex-col items-start gap-1 message-fade-in">
                    <div class="voice-msg voice-msg-received">
                        <i data-lucide="mic" class="w-4 h-4"></i>
                        <span>Voice message</span>
                        <i data-lucide="play" class="w-4 h-4 ml-2 cursor-pointer hover:scale-110 transition" onclick="playVoiceMessage(this, '${audioData}')"></i>
                    </div>
                    <span class="text-[8px] text-slate-500 font-bold uppercase ml-2">Received</span>
                </div>
            `;
            
            document.getElementById('message-flow').insertAdjacentHTML('beforeend', html);
            document.getElementById('message-flow').scrollTop = document.getElementById('message-flow').scrollHeight;
            lucide.createIcons();
        }

        function playVoiceMessage(element, base64Audio) {
            const audio = new Audio(`data:audio/webm;base64,${base64Audio}`);
            audio.play();
            
            // Change icon while playing
            const icon = element;
            icon.setAttribute('data-lucide', 'pause');
            lucide.createIcons();
            
            audio.onended = () => {
                icon.setAttribute('data-lucide', 'play');
                lucide.createIcons();
            };
        }

        function checkExistingFriends() {
            friends = [];
            filteredFriends = [];
            renderContacts();
        }

        function backToSidebar() {
            document.getElementById('sidebar').classList.remove('mobile-hidden');
            const chatArea = document.getElementById('chat-area');
            chatArea.classList.add('mobile-hidden');
            chatArea.classList.remove('active');
            activeFriend = null;
        }

        function toggleTheme() {
            isDark = !isDark;
            document.body.classList.toggle('light-mode', !isDark);
            lucide.createIcons();
        }

        // Setup event listeners
        document.addEventListener('DOMContentLoaded', () => {
            const input = document.getElementById('main-input');
            const sendTrigger = document.getElementById('send-trigger');
            
            sendTrigger.onclick = sendMessage;
            
            input.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            };
            
            input.oninput = function() {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
            };
        });

        // Initial setup
        document.getElementById('setup-name').value = '';
        lucide.createIcons();


document.addEventListener('contextmenu', event => event.preventDefault());

