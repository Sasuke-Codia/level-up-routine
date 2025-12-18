// App State
const app = {
    user: null,
    routines: [],
    level: 1,
    points: 0,
    completedToday: [],
    performanceHistory: [],
    currentView: 'todos',
    calendarView: 'day',
    calendarDate: new Date(),
    editingRoutineId: null,

    init() {
        // Erstelle Demo-User wenn keiner existiert
        const currentUserId = localStorage.getItem('currentUserId');
        if (!currentUserId) {
            const userId = `demo_${Date.now()}`;
            this.user = {
                id: userId,
                name: 'Demo User',
                provider: 'Demo',
                joinedDate: new Date().toISOString()
            };
            localStorage.setItem('currentUserId', userId);
        }
        
        this.loadFromStorage();
        this.updatePerformanceHistory();
        this.showDashboard();
        
        // Starte Notification-Check (alle 30 Sekunden)
        this.startNotificationCheck();
        
        // Fordere Notification-Permission an
        this.requestNotificationPermission();
    },

    // Notification Permission
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },

    // Start Notification Check
    startNotificationCheck() {
        // Prüfe sofort
        this.checkUpcomingTodos();
        
        // Dann alle 30 Sekunden
        setInterval(() => {
            this.checkUpcomingTodos();
        }, 30000);
    },

    // Check Upcoming Todos
    checkUpcomingTodos() {
        const now = new Date();
        const todayRoutines = this.getRoutinesForDate(now);
        const notifiedKey = 'notifiedTodos_' + now.toDateString();
        const notifiedTodos = JSON.parse(localStorage.getItem(notifiedKey) || '[]');
        
        todayRoutines.forEach(routine => {
            const [hours, minutes] = routine.time.split(':').map(Number);
            const routineTime = new Date();
            routineTime.setHours(hours, minutes, 0, 0);
            
            const timeDiff = routineTime - now;
            const minutesUntil = Math.floor(timeDiff / 60000);
            
            // Benachrichtigung 5 Minuten vorher
            if (minutesUntil === 5 && !notifiedTodos.includes(routine.instanceId)) {
                this.showNotification(routine);
                notifiedTodos.push(routine.instanceId);
                localStorage.setItem(notifiedKey, JSON.stringify(notifiedTodos));
            }
        });
    },

    // Show Notification
    showNotification(routine) {
        const message = `${routine.name} startet in 5 Minuten!`;
        const time = `Um ${routine.time} Uhr • ${routine.duration} Min`;
        
        // WhatsApp-Style Pop-up
        document.getElementById('notificationMessage').textContent = message;
        document.getElementById('notificationTime').textContent = time;
        
        const popup = document.getElementById('notificationPopup');
        popup.classList.add('show');
        
        // Auto-Close nach 8 Sekunden
        setTimeout(() => {
            this.closeNotification();
        }, 8000);
        
        // Browser-Notification (falls erlaubt)
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Level Up Routine', {
                body: message,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%2300ffff"/></svg>',
                badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%2300ffff"/></svg>'
            });
        }
    },

    // Close Notification
    closeNotification() {
        const popup = document.getElementById('notificationPopup');
        popup.classList.remove('show');
    },

    // Login
    login(provider) {
        // Generiere eindeutige User-ID basierend auf Provider und Zeitstempel
        const userId = `${provider}_${Date.now()}`;
        this.user = {
            id: userId,
            name: `${provider} User`,
            provider: provider,
            joinedDate: new Date().toISOString()
        };
        // Speichere User-ID im localStorage
        localStorage.setItem('currentUserId', userId);
        this.saveToStorage();
        this.showOnboarding();
    },

    // Logout
    logout() {
        if (confirm('Möchtest du dich wirklich abmelden?')) {
            // Entferne nur die aktuelle User-ID, aber behalte Daten
            localStorage.removeItem('currentUserId');
            this.user = null;
            this.showLogin();
        }
    },

    // Show Login
    showLogin() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('loginScreen').classList.add('active');
    },

    // Show Profile
    showProfile() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('profileScreen').classList.add('active');
        this.updateNavButtons('profileScreen');
        this.renderProfile();
    },

    // Render Profile
    renderProfile() {
        if (!this.user) return;
        
        document.getElementById('profileUserName').textContent = this.user.name;
        document.getElementById('profileProvider').textContent = `Angemeldet mit ${this.user.provider}`;
        document.getElementById('profileLevel').textContent = this.level;
        document.getElementById('profilePoints').textContent = this.points;
        document.getElementById('profileRoutines').textContent = this.routines.length;
        
        const joinedDate = new Date(this.user.joinedDate);
        document.getElementById('profileJoinedDate').textContent = joinedDate.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    // Update Frequency Options
    updateFrequencyOptions() {
        const frequency = document.getElementById('routineFrequency').value;
        const weekdaysGroup = document.getElementById('weekdaysGroup');
        const monthdaysGroup = document.getElementById('monthdaysGroup');
        const frequencyCountGroup = document.getElementById('frequencyCountGroup');
        const timeGroup = document.getElementById('timeGroup');
        const durationGroup = document.getElementById('durationGroup');
        const frequencyCountInput = document.getElementById('frequencyCount');
        
        weekdaysGroup.style.display = 'none';
        monthdaysGroup.style.display = 'none';
        document.getElementById('weekdayTimeFields').innerHTML = '';
        document.getElementById('dailyTimeFields').innerHTML = '';
        
        if (frequency === 'täglich') {
            frequencyCountInput.max = '10';
            frequencyCountGroup.querySelector('small').textContent = 'z.B. 2x täglich';
            frequencyCountGroup.style.display = 'block';
            
            const count = parseInt(frequencyCountInput.value) || 1;
            if (count > 1) {
                timeGroup.style.display = 'none';
                durationGroup.style.display = 'none';
                this.updateDailyTimeFields();
            } else {
                timeGroup.style.display = 'block';
                durationGroup.style.display = 'block';
            }
        } else if (frequency === 'wöchentlich') {
            weekdaysGroup.style.display = 'block';
            frequencyCountGroup.style.display = 'none';
            timeGroup.style.display = 'none';
            durationGroup.style.display = 'none';
        } else if (frequency === 'monatlich') {
            monthdaysGroup.style.display = 'block';
            frequencyCountInput.max = '31';
            frequencyCountGroup.querySelector('small').textContent = 'z.B. 2x monatlich';
            timeGroup.style.display = 'block';
            durationGroup.style.display = 'block';
        }
    },

    // Update Daily Time Fields
    updateDailyTimeFields() {
        const frequency = document.getElementById('routineFrequency').value;
        if (frequency !== 'täglich') return;
        
        const count = parseInt(document.getElementById('frequencyCount').value) || 1;
        const container = document.getElementById('dailyTimeFields');
        const timeGroup = document.getElementById('timeGroup');
        const durationGroup = document.getElementById('durationGroup');
        
        if (count > 1) {
            timeGroup.style.display = 'none';
            durationGroup.style.display = 'none';
            
            let html = '';
            for (let i = 1; i <= count; i++) {
                html += `
                    <div class="weekday-time-field">
                        <h4>${i}. Ausführung</h4>
                        <div class="weekday-time-inputs">
                            <div>
                                <label>Uhrzeit</label>
                                <input type="time" id="dailyTime${i}" value="08:00">
                            </div>
                            <div>
                                <label>Dauer (Min)</label>
                                <input type="number" id="dailyDuration${i}" value="15" min="1">
                            </div>
                        </div>
                    </div>
                `;
            }
            container.innerHTML = html;
        } else {
            container.innerHTML = '';
            timeGroup.style.display = 'block';
            durationGroup.style.display = 'block';
        }
    },

    updateWeekdayTimeFields() {
        const checkboxes = document.querySelectorAll('#weekdaysGroup input[type="checkbox"]:checked');
        const container = document.getElementById('weekdayTimeFields');
        const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        
        let html = '';
        checkboxes.forEach(cb => {
            const dayValue = cb.value;
            const dayName = dayNames[parseInt(dayValue)];
            html += `
                <div class="weekday-time-field">
                    <h4>${dayName}</h4>
                    <div class="weekday-time-inputs">
                        <div>
                            <label>Uhrzeit</label>
                            <input type="time" id="time_${dayValue}" value="08:00">
                        </div>
                        <div>
                            <label>Dauer (Min)</label>
                            <input type="number" id="duration_${dayValue}" min="1" value="15">
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },

    // Add Routine
    addRoutine() {
        const name = document.getElementById('routineName').value;
        const points = parseInt(document.getElementById('routinePoints').value);
        const frequency = document.getElementById('routineFrequency').value;
        const frequencyCount = parseInt(document.getElementById('frequencyCount').value);
        const time = document.getElementById('routineTime').value;
        const duration = parseInt(document.getElementById('routineDuration').value);

        if (!name) {
            alert('Bitte gib einen Namen für die Routine ein!');
            return;
        }
        
        // Get daily schedule for multiple daily executions
        let dailySchedule = [];
        if (frequency === 'täglich' && frequencyCount > 1) {
            for (let i = 1; i <= frequencyCount; i++) {
                const timeInput = document.getElementById(`dailyTime${i}`);
                const durationInput = document.getElementById(`dailyDuration${i}`);
                
                if (timeInput && durationInput) {
                    dailySchedule.push({
                        time: timeInput.value,
                        duration: parseInt(durationInput.value)
                    });
                }
            }
        }
        
        // Get selected weekdays with times for weekly routines
        let weekdaySchedule = [];
        if (frequency === 'wöchentlich') {
            const checkboxes = document.querySelectorAll('#weekdaysGroup input[type="checkbox"]:checked');
            checkboxes.forEach(cb => {
                const dayValue = parseInt(cb.value);
                const timeInput = document.getElementById(`time_${dayValue}`);
                const durationInput = document.getElementById(`duration_${dayValue}`);
                
                if (timeInput && durationInput) {
                    weekdaySchedule.push({
                        day: dayValue,
                        time: timeInput.value,
                        duration: parseInt(durationInput.value)
                    });
                }
            });
            
            if (weekdaySchedule.length === 0) {
                alert('Bitte wähle mindestens einen Wochentag aus!');
                return;
            }
        }
        
        // Get month days for monthly routines
        let monthDays = [];
        if (frequency === 'monatlich') {
            const monthDaysInput = document.getElementById('monthDays').value;
            if (monthDaysInput.trim()) {
                monthDays = monthDaysInput.split(',').map(d => parseInt(d.trim())).filter(d => d >= 1 && d <= 31);
            }
            if (monthDays.length === 0) {
                alert('Bitte gib mindestens einen Tag im Monat ein (z.B. 1,15)!');
                return;
            }
        }

        const routine = {
            id: Date.now(),
            name,
            points,
            frequency,
            frequencyCount: frequency !== 'wöchentlich' ? frequencyCount : weekdaySchedule.length,
            dailySchedule: dailySchedule.length > 0 ? dailySchedule : null,
            weekdaySchedule,
            monthDays,
            time: frequency !== 'wöchentlich' && dailySchedule.length === 0 ? time : null,
            duration: frequency !== 'wöchentlich' && dailySchedule.length === 0 ? duration : null,
            createdAt: new Date().toISOString()
        };

        this.routines.push(routine);
        this.saveToStorage();

        // Clear form
        document.getElementById('routineName').value = '';
        document.getElementById('routinePoints').value = '5';
        document.getElementById('routineFrequency').value = 'täglich';
        document.getElementById('frequencyCount').value = '1';
        document.getElementById('routineTime').value = '08:00';
        document.getElementById('routineDuration').value = '15';
        document.getElementById('monthDays').value = '';
        document.querySelectorAll('#weekdaysGroup input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        document.getElementById('weekdayTimeFields').innerHTML = '';
        this.updateFrequencyOptions();

        // Ask if user wants to add more
        if (this.routines.length < 30) {
            const addMore = confirm('Möchtest du eine weitere Routine hinzufügen?');
            if (addMore) {
                return;
            }
        }

        this.showRoutineOverview();
    },

    // Delete Routine
    deleteRoutine(id) {
        if (confirm('Möchtest du diese Routine wirklich löschen? Deine bisherigen Punkte bleiben erhalten.')) {
            this.routines = this.routines.filter(r => r.id !== id);
            this.saveToStorage();
            this.showRoutineOverview();
        }
    },

    // Edit Routine
    editRoutine(id) {
        const routine = this.routines.find(r => r.id === id);
        if (!routine) return;

        this.editingRoutineId = id;
        
        // Fill form with current values
        document.getElementById('editRoutineName').value = routine.name;
        document.getElementById('editRoutinePoints').value = routine.points;
        document.getElementById('editRoutineFrequency').value = routine.frequency;
        document.getElementById('editFrequencyCount').value = routine.frequencyCount || 1;
        document.getElementById('editRoutineTime').value = routine.time || '08:00';
        document.getElementById('editRoutineDuration').value = routine.duration || 15;
        
        // Set weekday schedule
        if (routine.weekdaySchedule) {
            document.querySelectorAll('#editWeekdaySelector input[type="checkbox"]').forEach(cb => {
                const hasDay = routine.weekdaySchedule.find(s => s.day === parseInt(cb.value));
                cb.checked = !!hasDay;
            });
            
            this.updateEditFrequencyOptions();
            
            // Fill in times and durations
            setTimeout(() => {
                routine.weekdaySchedule.forEach(schedule => {
                    const timeInput = document.getElementById(`edit_time_${schedule.day}`);
                    const durationInput = document.getElementById(`edit_duration_${schedule.day}`);
                    if (timeInput) timeInput.value = schedule.time;
                    if (durationInput) durationInput.value = schedule.duration;
                });
            }, 50);
        } else {
            document.querySelectorAll('#editWeekdaySelector input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
        }
        
        // Set month days
        if (routine.monthDays) {
            document.getElementById('editMonthDays').value = routine.monthDays.join(',');
        } else {
            document.getElementById('editMonthDays').value = '';
        }
        
        if (routine.frequency !== 'wöchentlich') {
            this.updateEditFrequencyOptions();
        }
        
        document.getElementById('editModal').classList.add('active');
    },

    // Update Edit Frequency Options
    updateEditFrequencyOptions() {
        const frequency = document.getElementById('editRoutineFrequency').value;
        const weekdaysGroup = document.getElementById('editWeekdaysGroup');
        const monthdaysGroup = document.getElementById('editMonthdaysGroup');
        const frequencyCountGroup = document.getElementById('editFrequencyCountGroup');
        const timeGroup = document.getElementById('editTimeGroup');
        const durationGroup = document.getElementById('editDurationGroup');
        const frequencyCountInput = document.getElementById('editFrequencyCount');
        
        weekdaysGroup.style.display = 'none';
        monthdaysGroup.style.display = 'none';
        document.getElementById('editWeekdayTimeFields').innerHTML = '';
        
        if (frequency === 'täglich') {
            frequencyCountInput.max = '10';
            frequencyCountGroup.querySelector('small').textContent = 'z.B. 2x täglich';
            timeGroup.style.display = 'block';
            durationGroup.style.display = 'block';
        } else if (frequency === 'wöchentlich') {
            weekdaysGroup.style.display = 'block';
            frequencyCountGroup.style.display = 'none';
            timeGroup.style.display = 'none';
            durationGroup.style.display = 'none';
        } else if (frequency === 'monatlich') {
            monthdaysGroup.style.display = 'block';
            frequencyCountInput.max = '31';
            frequencyCountGroup.querySelector('small').textContent = 'z.B. 2x monatlich';
            timeGroup.style.display = 'block';
            durationGroup.style.display = 'block';
        }
    },

    updateEditWeekdayTimeFields() {
        const checkboxes = document.querySelectorAll('#editWeekdaySelector input[type="checkbox"]:checked');
        const container = document.getElementById('editWeekdayTimeFields');
        const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        
        let html = '';
        checkboxes.forEach(cb => {
            const dayValue = cb.value;
            const dayName = dayNames[parseInt(dayValue)];
            html += `
                <div class="weekday-time-field">
                    <h4>${dayName}</h4>
                    <div class="weekday-time-inputs">
                        <div>
                            <label>Uhrzeit</label>
                            <input type="time" id="edit_time_${dayValue}" value="08:00">
                        </div>
                        <div>
                            <label>Dauer (Min)</label>
                            <input type="number" id="edit_duration_${dayValue}" min="1" value="15">
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },

    // Save Edited Routine
    saveEditedRoutine() {
        const name = document.getElementById('editRoutineName').value;
        const points = parseInt(document.getElementById('editRoutinePoints').value);
        const frequency = document.getElementById('editRoutineFrequency').value;
        const frequencyCount = parseInt(document.getElementById('editFrequencyCount').value);
        const time = document.getElementById('editRoutineTime').value;
        const duration = parseInt(document.getElementById('editRoutineDuration').value);

        if (!name) {
            alert('Bitte gib einen Namen für die Routine ein!');
            return;
        }
        
        // Get selected weekdays with times for weekly routines
        let weekdaySchedule = [];
        if (frequency === 'wöchentlich') {
            const checkboxes = document.querySelectorAll('#editWeekdaySelector input[type="checkbox"]:checked');
            checkboxes.forEach(cb => {
                const dayValue = parseInt(cb.value);
                const timeInput = document.getElementById(`edit_time_${dayValue}`);
                const durationInput = document.getElementById(`edit_duration_${dayValue}`);
                
                if (timeInput && durationInput) {
                    weekdaySchedule.push({
                        day: dayValue,
                        time: timeInput.value,
                        duration: parseInt(durationInput.value)
                    });
                }
            });
            
            if (weekdaySchedule.length === 0) {
                alert('Bitte wähle mindestens einen Wochentag aus!');
                return;
            }
        }
        
        // Get month days for monthly routines
        let monthDays = [];
        if (frequency === 'monatlich') {
            const monthDaysInput = document.getElementById('editMonthDays').value;
            if (monthDaysInput.trim()) {
                monthDays = monthDaysInput.split(',').map(d => parseInt(d.trim())).filter(d => d >= 1 && d <= 31);
            }
            if (monthDays.length === 0) {
                alert('Bitte gib mindestens einen Tag im Monat ein (z.B. 1,15)!');
                return;
            }
        }
        
        // Update routine
        const routineIndex = this.routines.findIndex(r => r.id === this.editingRoutineId);
        if (routineIndex !== -1) {
            this.routines[routineIndex] = {
                ...this.routines[routineIndex],
                name,
                points,
                frequency,
                frequencyCount: frequency !== 'wöchentlich' ? frequencyCount : weekdaySchedule.length,
                weekdaySchedule,
                monthDays,
                time: frequency !== 'wöchentlich' ? time : null,
                duration: frequency !== 'wöchentlich' ? duration : null
            };
            
            this.saveToStorage();
            this.closeEditModal();
            this.showRoutineOverview();
        }
    },

    // Close Edit Modal
    closeEditModal() {
        document.getElementById('editModal').classList.remove('active');
        this.editingRoutineId = null;
    },

    // Delete Routine from Modal
    deleteRoutineFromModal() {
        if (confirm('Möchtest du diese Routine wirklich löschen? Deine bisherigen Punkte bleiben erhalten.')) {
            this.routines = this.routines.filter(r => r.id !== this.editingRoutineId);
            this.saveToStorage();
            this.closeEditModal();
            this.showRoutineOverview();
        }
    },

    // Complete Todo
    completeTodo(instanceId) {
        const [routineId, instanceIndex] = instanceId.includes('-') ? instanceId.split('-').map(Number) : [Number(instanceId), 0];
        const routine = this.routines.find(r => r.id === routineId);
        if (!routine) return;

        const today = this.getTodayKey();
        if (!this.completedToday[today]) {
            this.completedToday[today] = [];
        }

        const existingIndex = this.completedToday[today].findIndex(c => c.instanceId === instanceId);
        if (existingIndex === -1) {
            this.completedToday[today].push({
                routineId,
                instanceId,
                status: 'completed',
                timestamp: new Date().toISOString()
            });

            this.points += routine.points;
            this.checkLevelUp();
            this.updatePerformanceHistory();
            this.saveToStorage();
            this.renderDashboard();
        }
    },

    // Skip Todo
    skipTodo(instanceId) {
        const [routineId, instanceIndex] = instanceId.includes('-') ? instanceId.split('-').map(Number) : [Number(instanceId), 0];
        const routine = this.routines.find(r => r.id === routineId);
        if (!routine) return;

        const today = this.getTodayKey();
        if (!this.completedToday[today]) {
            this.completedToday[today] = [];
        }

        const existingIndex = this.completedToday[today].findIndex(c => c.instanceId === instanceId);
        if (existingIndex === -1) {
            this.completedToday[today].push({
                routineId,
                instanceId,
                status: 'skipped',
                timestamp: new Date().toISOString()
            });

            // Punkte Abzug (halbe Punkte)
            this.points = Math.max(0, this.points - Math.floor(routine.points / 2));
            this.updatePerformanceHistory();
            this.saveToStorage();
            this.renderDashboard();
        }
    },

    // Check Level Up
    checkLevelUp() {
        while (this.points >= 100) {
            this.points -= 100;
            this.level++;
            this.showLevelUpAnimation();
        }
    },

    showLevelUpAnimation() {
        alert(`🎉 LEVEL UP! Du bist jetzt Level ${this.level}! 🎉`);
    },

    // Get Today's Status
    getTodayStatus(instanceId) {
        const today = this.getTodayKey();
        if (!this.completedToday[today]) return null;
        return this.completedToday[today].find(c => c.instanceId === instanceId);
    },

    getTodayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },

    // Get Daily Routines
    getDailyRoutines() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const dayOfMonth = today.getDate();
        
        const dailyRoutines = [];
        
        this.routines.forEach(routine => {
            let shouldShow = false;
            let timesToShow = 1;
            
            if (routine.frequency === 'täglich') {
                shouldShow = true;
                timesToShow = routine.frequencyCount || 1;
            } else if (routine.frequency === 'wöchentlich') {
                // Check if today is in selected weekdays
                if (routine.weekdays && routine.weekdays.includes(dayOfWeek)) {
                    shouldShow = true;
                    timesToShow = routine.frequencyCount || 1;
                }
            } else if (routine.frequency === 'monatlich') {
                // Check if today is in selected month days
                if (routine.monthDays && routine.monthDays.includes(dayOfMonth)) {
                    shouldShow = true;
                    timesToShow = routine.frequencyCount || 1;
                }
            }
            
            // Add routine multiple times if frequencyCount > 1
            if (shouldShow) {
                for (let i = 0; i < timesToShow; i++) {
                    dailyRoutines.push({
                        ...routine,
                        instanceId: `${routine.id}-${i}`,
                        instanceIndex: i,
                        instanceTotal: timesToShow
                    });
                }
            }
        });
        
        return dailyRoutines;
    },

    // Get Next Task
    getNextTask() {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const dailyRoutines = this.getDailyRoutines();
        const incompleteTasks = dailyRoutines.filter(r => !this.getTodayStatus(r.instanceId));
        
        if (incompleteTasks.length === 0) return null;

        // Find next task by time
        const upcoming = incompleteTasks.find(r => {
            const [hours, minutes] = r.time.split(':').map(Number);
            const routineTime = hours * 60 + minutes;
            return routineTime > currentTime;
        });

        return upcoming || incompleteTasks[0];
    },

    // Calculate Daily Progress
    getDailyProgress() {
        const dailyRoutines = this.getDailyRoutines();
        if (dailyRoutines.length === 0) return 100;

        const completed = dailyRoutines.filter(r => {
            const status = this.getTodayStatus(r.instanceId);
            return status && status.status === 'completed';
        }).length;

        return Math.round((completed / dailyRoutines.length) * 100);
    },

    // Update Performance History
    updatePerformanceHistory() {
        const today = this.getTodayKey();
        const progress = this.getDailyProgress();
        
        // Store last 7 days
        const existingIndex = this.performanceHistory.findIndex(p => p.date === today);
        if (existingIndex >= 0) {
            this.performanceHistory[existingIndex].progress = progress;
        } else {
            this.performanceHistory.push({ date: today, progress });
        }

        // Keep only last 7 days
        this.performanceHistory = this.performanceHistory.slice(-7);
        this.saveToStorage();
    },

    // Navigation
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    },

    showOnboarding(addingMore = false) {
        this.showScreen('onboardingScreen');
    },

    showRoutineOverview() {
        this.showScreen('routineOverviewScreen');
        this.updateNavButtons('routineOverviewScreen');
        this.renderRoutineOverview();
    },

    showDashboard() {
        this.showScreen('dashboardScreen');
        this.updateNavButtons('dashboardScreen');
        this.renderDashboard();
    },

    showTodosFullscreen() {
        this.showScreen('todosFullscreenScreen');
        this.updateNavButtons('todosFullscreenScreen');
        this.renderTodosFullscreen();
    },

    renderTodosFullscreen() {
        const container = document.getElementById('todosFullscreenList');
        const dailyRoutines = this.getDailyRoutines();

        if (dailyRoutines.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Keine Aufgaben für heute.</p>';
            return;
        }

        const html = dailyRoutines.map(routine => {
            const status = this.getTodayStatus(routine.instanceId);
            const statusClass = status ? status.status : '';
            const instanceLabel = routine.instanceTotal > 1 ? ` (${routine.instanceIndex + 1}/${routine.instanceTotal})` : '';
            
            return `
                <div class="todo-item ${statusClass}">
                    <div class="todo-info">
                        <div class="todo-name">${routine.name}${instanceLabel}</div>
                        <div class="todo-time">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 4px;">
                                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                            </svg>
                            ${routine.time} Uhr • ${routine.points} Punkte
                        </div>
                    </div>
                    <div class="todo-actions">
                        ${!status ? `
                            <button class="action-btn btn-complete" onclick="app.completeTodo('${routine.instanceId}'); app.renderTodosFullscreen();">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                </svg>
                            </button>
                            <button class="action-btn btn-skip" onclick="app.skipTodo('${routine.instanceId}'); app.renderTodosFullscreen();">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                            </button>
                        ` : `
                            <div style="font-size: 2rem;">
                                ${status.status === 'completed' ? '✅' : '❌'}
                            </div>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    showCalendar() {
        this.showScreen('calendarScreen');
        this.updateNavButtons('calendarScreen');
        this.renderCalendar();
    },

    setCalendarView(view) {
        this.calendarView = view;
        document.querySelectorAll('.calendar-view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        this.renderCalendar();
    },

    navigateCalendar(direction) {
        if (this.calendarView === 'day') {
            this.calendarDate.setDate(this.calendarDate.getDate() + direction);
        } else if (this.calendarView === 'week') {
            this.calendarDate.setDate(this.calendarDate.getDate() + (direction * 7));
        } else if (this.calendarView === 'month') {
            this.calendarDate.setMonth(this.calendarDate.getMonth() + direction);
        }
        this.renderCalendar();
    },

    updateNavButtons(activeScreen) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const screenMap = {
            'dashboardScreen': 0,
            'todosFullscreenScreen': 1,
            'calendarScreen': 2,
            'routineOverviewScreen': 3,
            'onboardingScreen': 3
        };
        
        if (screenMap[activeScreen] !== undefined) {
            document.querySelectorAll('.bottom-nav').forEach(nav => {
                if (nav.children[screenMap[activeScreen]]) {
                    nav.children[screenMap[activeScreen]].classList.add('active');
                }
            });
        }
    },

    getRoutinesForDate(date) {
        const dayOfWeek = date.getDay();
        const dayOfMonth = date.getDate();
        
        const routines = [];
        
        this.routines.forEach(routine => {
            if (routine.frequency === 'täglich') {
                // Prüfe ob dailySchedule existiert (mehrfache Ausführungen mit eigenen Zeiten)
                if (routine.dailySchedule && routine.dailySchedule.length > 0) {
                    routine.dailySchedule.forEach((schedule, index) => {
                        routines.push({
                            ...routine,
                            time: schedule.time,
                            duration: schedule.duration,
                            instanceId: `${routine.id}-daily-${index}`,
                            instanceIndex: index,
                            instanceTotal: routine.dailySchedule.length
                        });
                    });
                } else {
                    // Alte Logik: frequencyCount mal mit gleicher Zeit
                    const timesToShow = routine.frequencyCount || 1;
                    for (let i = 0; i < timesToShow; i++) {
                        routines.push({
                            ...routine,
                            instanceId: `${routine.id}-${i}`,
                            instanceIndex: i,
                            instanceTotal: timesToShow
                        });
                    }
                }
            } else if (routine.frequency === 'wöchentlich') {
                if (routine.weekdays && routine.weekdays.includes(dayOfWeek)) {
                    shouldShow = true;
                    timesToShow = routine.frequencyCount || 1;
                }
            } else if (routine.frequency === 'monatlich') {
                if (routine.monthDays && routine.monthDays.includes(dayOfMonth)) {
                    shouldShow = true;
                    timesToShow = routine.frequencyCount || 1;
                }
            }
            
            if (shouldShow) {
                for (let i = 0; i < timesToShow; i++) {
                    routines.push({
                        ...routine,
                        instanceId: `${routine.id}-${i}`,
                        instanceIndex: i,
                        instanceTotal: timesToShow
                    });
                }
            }
        });
        
        return routines;
    },

    getTodoColor(count) {
        if (count === 0) return 'transparent';
        if (count <= 2) return '#0088ff';
        if (count <= 4) return '#00ddff';
        if (count <= 7) return '#ffaa00';
        if (count <= 9) return '#ff6600';
        return '#ff0033';
    },

    // Rendering
    render() {
        if (!this.user) {
            this.showScreen('loginScreen');
        } else if (this.routines.length === 0) {
            this.showOnboarding();
        } else {
            this.showDashboard();
        }
    },

    renderRoutineOverview() {
        const container = document.getElementById('routinesList');
        const categories = {
            'täglich': [],
            'wöchentlich': [],
            'monatlich': []
        };

        this.routines.forEach(routine => {
            categories[routine.frequency].push(routine);
        });

        let html = '';
        Object.keys(categories).forEach(frequency => {
            if (categories[frequency].length > 0) {
                html += `
                    <div class="routine-category">
                        <div class="category-title">${frequency.toUpperCase()}</div>
                        ${categories[frequency].map(r => {
                            let frequencyText = '';
                            if (r.frequency === 'täglich' && r.frequencyCount > 1) {
                                frequencyText = `${r.frequencyCount}x • `;
                            }
                            let dayInfo = '';
                            if (r.frequency === 'wöchentlich' && r.weekdaySchedule) {
                                const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
                                dayInfo = r.weekdaySchedule.map(s => {
                                    return `${dayNames[s.day]} ${s.time}`;
                                }).join(', ');
                            } else if (r.frequency === 'monatlich' && r.monthDays) {
                                dayInfo = r.monthDays.join(', ') + '. Tag';
                            }
                            
                            let timeDisplay = '';
                            if (r.frequency !== 'wöchentlich' && r.time) {
                                timeDisplay = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 4px;"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>${r.time} Uhr • <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 4px;"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>${r.duration} Min`;
                            }
                            
                            return `
                            <div class="routine-item" onclick="app.editRoutine(${r.id})" style="cursor: pointer;">
                                <div class="routine-info">
                                    <h4>${r.name}</h4>
                                    <div class="routine-details">
                                        ${frequencyText}${timeDisplay}
                                        ${dayInfo ? `<br><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 4px;"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>${dayInfo}` : ''}
                                    </div>
                                </div>
                                <div class="routine-points">${r.points} ⭐</div>
                            </div>
                        `;
                        }).join('')}
                    </div>
                `;
            }
        });

        container.innerHTML = html || '<p style="color: var(--text-secondary);">Noch keine Routinen angelegt.</p>';
    },

    renderDashboard() {
        // Level & Points
        document.getElementById('levelDisplay').textContent = this.level;
        document.getElementById('pointsDisplay').textContent = `${this.points}/100`;
        document.getElementById('progressBar').style.width = `${this.points}%`;

        // Next Task
        const nextTask = this.getNextTask();
        const nextTaskDisplay = document.getElementById('nextTaskDisplay');
        if (nextTask) {
            nextTaskDisplay.innerHTML = `
                <strong>${nextTask.name}</strong><br>
                <span style="color: var(--text-secondary);">⏰ ${nextTask.time} Uhr</span>
            `;
        } else {
            nextTaskDisplay.textContent = 'Alle Aufgaben erledigt! 🎉';
        }

        // Daily Progress
        const progress = this.getDailyProgress();
        document.getElementById('dailyProgressText').textContent = `${progress}%`;
        
        const circumference = 2 * Math.PI * 40;
        const offset = circumference - (progress / 100) * circumference;
        document.getElementById('dailyProgressCircle').style.strokeDashoffset = offset;

        // Todos List
        this.renderTodosList();

        // Performance Graph
        this.renderPerformanceGraph();
    },

    renderTodosList() {
        const container = document.getElementById('todosList');
        const dailyRoutines = this.getDailyRoutines();

        if (dailyRoutines.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Keine Aufgaben für heute.</p>';
            return;
        }

        const html = dailyRoutines.map(routine => {
            const status = this.getTodayStatus(routine.instanceId);
            const statusClass = status ? status.status : '';
            const instanceLabel = routine.instanceTotal > 1 ? ` (${routine.instanceIndex + 1}/${routine.instanceTotal})` : '';
            
            return `
                <div class="todo-item ${statusClass}">
                    <div class="todo-info">
                        <div class="todo-name">${routine.name}${instanceLabel}</div>
                        <div class="todo-time">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 4px;">
                                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                            </svg>
                            ${routine.time} Uhr • ${routine.points} Punkte
                        </div>
                    </div>
                    <div class="todo-actions">
                        ${!status ? `
                            <button class="action-btn btn-complete" onclick="app.completeTodo('${routine.instanceId}')">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                </svg>
                            </button>
                            <button class="action-btn btn-skip" onclick="app.skipTodo('${routine.instanceId}')">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                            </button>
                        ` : `
                            <div style="font-size: 2rem;">
                                ${status.status === 'completed' ? '✅' : '❌'}
                            </div>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    renderCalendar() {
        const container = document.getElementById('calendarContainer');
        const titleElement = document.getElementById('calendarTitle');
        
        if (this.calendarView === 'day') {
            this.renderDayView(container, titleElement);
        } else if (this.calendarView === 'week') {
            this.renderWeekView(container, titleElement);
        } else if (this.calendarView === 'month') {
            this.renderMonthView(container, titleElement);
        }
    },

    renderDayView(container, titleElement) {
        const date = new Date(this.calendarDate);
        const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        
        const isToday = this.isSameDay(date, new Date());
        titleElement.textContent = isToday ? 'Heute' : `${dayNames[date.getDay()]}, ${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
        
        const routines = this.getRoutinesForDate(date);
        
        // Group by time
        const timeSlots = {};
        routines.forEach(routine => {
            if (!timeSlots[routine.time]) {
                timeSlots[routine.time] = [];
            }
            timeSlots[routine.time].push(routine);
        });
        
        // Sort times
        const sortedTimes = Object.keys(timeSlots).sort();
        
        let html = '<div class="day-view">';
        
        if (sortedTimes.length === 0) {
            html += '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">Keine Routinen für diesen Tag geplant.</p>';
        } else {
            sortedTimes.forEach(time => {
                const tasks = timeSlots[time];
                const count = tasks.length;
                const color = this.getTodoColor(count);
                
                html += `
                    <div class="time-slot" style="border-left-color: ${color};">
                        <div class="time-slot-time">${time}</div>
                        <div class="time-slot-tasks">
                            ${tasks.map(t => `
                                <div class="time-slot-task">
                                    ${t.name}${t.instanceTotal > 1 ? ` (${t.instanceIndex + 1}/${t.instanceTotal})` : ''}
                                    <span style="color: var(--accent-primary); margin-left: 8px;">${t.points}⭐</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="time-slot-count">${count}</div>
                    </div>
                `;
            });
        }
        
        html += '</div>';
        container.innerHTML = html;
    },

    renderWeekView(container, titleElement) {
        const startOfWeek = new Date(this.calendarDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        
        titleElement.textContent = `${startOfWeek.getDate()}.${startOfWeek.getMonth() + 1}. - ${endOfWeek.getDate()}.${endOfWeek.getMonth() + 1}.${endOfWeek.getFullYear()}`;
        
        const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
        
        let html = '<div class="week-view">';
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(date.getDate() + i);
            
            const routines = this.getRoutinesForDate(date);
            const count = routines.length;
            const color = this.getTodoColor(count);
            
            const isToday = this.isSameDay(date, new Date());
            const dateLabel = isToday ? 'Heute' : `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
            
            html += `
                <div class="week-day ${isToday ? 'today' : ''}" style="border-left-color: ${color};">
                    <div class="week-day-header">
                        <div>
                            <div class="week-day-name">${dayNames[i]}</div>
                            <div class="week-day-date">${dateLabel}</div>
                        </div>
                        <div class="week-day-count">${count}</div>
                    </div>
                    ${routines.length > 0 ? `
                        <div class="week-day-tasks">
                            ${routines.map(r => `
                                <div class="week-day-task-pill">
                                    ${r.time} ${r.name}${r.instanceTotal > 1 ? ` (${r.instanceIndex + 1})` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 8px;">Keine Routinen</p>
                    `}
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    },

    renderMonthView(container, titleElement) {
        const year = this.calendarDate.getFullYear();
        const month = this.calendarDate.getMonth();
        
        const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        titleElement.textContent = `${monthNames[month]} ${year}`;
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();
        
        const today = new Date();
        
        let html = '<div class="month-view">';
        
        // Day headers
        const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        dayNames.forEach(day => {
            html += `<div class="month-day-header">${day}</div>`;
        });
        
        // Previous month days
        const startDay = firstDay === 0 ? 6 : firstDay - 1;
        for (let i = startDay - 1; i >= 0; i--) {
            const date = new Date(year, month - 1, prevMonthDays - i);
            const routines = this.getRoutinesForDate(date);
            const count = routines.length;
            const color = this.getTodoColor(count);
            
            html += `
                <div class="month-day other-month" style="background: ${color};">
                    <div class="month-day-number">${prevMonthDays - i}</div>
                    ${count > 0 ? `<div class="month-day-count">${count}</div>` : ''}
                </div>
            `;
        }
        
        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const routines = this.getRoutinesForDate(date);
            const count = routines.length;
            const color = this.getTodoColor(count);
            
            const isToday = this.isSameDay(date, today);
            
            html += `
                <div class="month-day ${isToday ? 'today' : ''}" style="background: ${color};">
                    <div class="month-day-number">${day}</div>
                    ${count > 0 ? `<div class="month-day-count">${count}</div>` : ''}
                </div>
            `;
        }
        
        // Next month days
        const remainingCells = 42 - (startDay + daysInMonth);
        for (let i = 1; i <= remainingCells && remainingCells < 7; i++) {
            const date = new Date(year, month + 1, i);
            const routines = this.getRoutinesForDate(date);
            const count = routines.length;
            const color = this.getTodoColor(count);
            
            html += `
                <div class="month-day other-month" style="background: ${color};">
                    <div class="month-day-number">${i}</div>
                    ${count > 0 ? `<div class="month-day-count">${count}</div>` : ''}
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    },

    isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    },

    renderPerformanceGraph() {
        const canvas = document.getElementById('performanceChart');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        canvas.width = canvas.offsetWidth;
        canvas.height = 200;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (this.performanceHistory.length === 0) {
            ctx.fillStyle = '#a0a8c1';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Noch keine Daten vorhanden', canvas.width / 2, canvas.height / 2);
            return;
        }

        const padding = 30;
        const graphWidth = canvas.width - padding * 2;
        const graphHeight = canvas.height - padding * 2;
        const pointSpacing = graphWidth / (this.performanceHistory.length - 1 || 1);

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding + (graphHeight * i / 4);
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvas.width - padding, y);
            ctx.stroke();
        }

        // Draw line
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.beginPath();

        this.performanceHistory.forEach((point, index) => {
            const x = padding + index * pointSpacing;
            const y = padding + graphHeight - (point.progress / 100 * graphHeight);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Draw points
        this.performanceHistory.forEach((point, index) => {
            const x = padding + index * pointSpacing;
            const y = padding + graphHeight - (point.progress / 100 * graphHeight);
            
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Draw percentage
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${point.progress}%`, x, y - 10);
        });

        // Draw labels
        ctx.fillStyle = '#a0a8c1';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        this.performanceHistory.forEach((point, index) => {
            const x = padding + index * pointSpacing;
            const date = new Date(point.date);
            const label = `${date.getDate()}.${date.getMonth() + 1}`;
            ctx.fillText(label, x, canvas.height - 10);
        });
    },

    // Storage
    saveToStorage() {
        if (this.user && this.user.id) {
            localStorage.setItem(`levelUpRoutine_${this.user.id}`, JSON.stringify({
                user: this.user,
                routines: this.routines,
                level: this.level,
                points: this.points,
                completedToday: this.completedToday,
                performanceHistory: this.performanceHistory
            }));
        }
    },

    loadFromStorage() {
        const currentUserId = localStorage.getItem('currentUserId');
        if (currentUserId) {
            const data = localStorage.getItem(`levelUpRoutine_${currentUserId}`);
            if (data) {
                const parsed = JSON.parse(data);
                this.user = parsed.user;
                this.routines = parsed.routines || [];
                this.level = parsed.level || 1;
                this.points = parsed.points || 0;
                this.completedToday = parsed.completedToday || {};
                this.performanceHistory = parsed.performanceHistory || [];
            }
        }
    }
};

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
