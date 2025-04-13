document.addEventListener('DOMContentLoaded', () => {

    // --- Конфигурация и Константы ---
    const VOTE_NAMESPACE = 'debate-timer-super-final-v2'; // !!! ИЗМЕНИ ЭТО НА УНИКАЛЬНОЕ ИМЯ ДЛЯ КАЖДЫХ ДЕБАТОВ !!!
    const API_BASE_URL = 'https://api.counterapi.dev/v1';
    const COUNTER_PEACE_KEY = 'peace';
    const COUNTER_WAR_KEY = 'war';
    const INITIAL_TIME = 90; // Секунды
    const WORDS_TO_ANIMATE = ["Свобода", "Надежда", "Мир", "Україна", "Воля", "Перемога", "Єдність", "Сила", "Майбутнє", "Життя", "Героям Слава!"];
    const WORD_SPAWN_INTERVAL = 2500; // мс (как часто появляется слово)
    const TARGET_SPAWN_INTERVAL = 1500; // мс (как часто появляется цель для кликера)
    const TARGET_LIFETIME = 2500; // мс (сколько живет цель, если не кликнуть)

    // --- Ссылки на DOM элементы ---
    const body = document.getElementById('body-main');
    const timerText = document.getElementById('timer-text');
    const timerProgressCircle = document.querySelector('.timer-progress-circle');
    const backgroundAnimationsDiv = document.getElementById('background-animations');
    const clickerGameArea = document.getElementById('clicker-game-area');
    const scoreDisplay = document.getElementById('score-display');
    const timerGameSection = document.getElementById('timer-game-section');
    const choiceSection = document.getElementById('choice-section');
    const resultSection = document.getElementById('result-section');
    const peaceBtn = document.getElementById('peaceBtn');
    const warBtn = document.getElementById('warBtn');
    const loadingIndicatorChoice = document.getElementById('loading-indicator-choice');
    const resultMessage = document.getElementById('result-message');
    const voteCountsDiv = document.getElementById('vote-counts');
    const peaceCountSpan = document.getElementById('peace-count');
    const warCountSpan = document.getElementById('war-count');
    const voteErrorP = document.getElementById('vote-error');

    // --- Переменные Состояния ---
    let timeLeft = INITIAL_TIME;
    let score = 0;
    let mainTimerInterval = null;
    let wordSpawnInterval = null;
    let targetSpawnInterval = null;
    let activeTimeouts = []; // Храним таймауты для очистки
    const CIRCLE_LENGTH = 283; // Длина окружности SVG круга

    // --- Функции API --- (Копируем из прошлого ответа)
    async function hitCounterAPI(key, action = 'get') {
        const endpoint = action === 'up' ? `${key}/up` : `${key}/`;
        const url = `${API_BASE_URL}/${VOTE_NAMESPACE}/${endpoint}`;
        try {
            console.log(`API Request: ${url}`);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            console.log(`API Response for ${key} (${action}):`, data);
            return data.count !== undefined ? data.count : (data.value !== undefined ? data.value : 0);
        } catch (error) {
            console.error(`API Fetch error for ${key} (${action}):`, error);
            voteErrorP.textContent = `Ошибка связи с сервером счетчика (${error.message}).`;
            voteErrorP.style.display = 'block';
            return null;
        }
    }

    // --- Функции Обновления UI ---
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerText.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        const progress = ((INITIAL_TIME - timeLeft) / INITIAL_TIME);
        const dashOffset = CIRCLE_LENGTH * (1 - progress);
        timerProgressCircle.style.strokeDashoffset = Math.max(0, dashOffset); // Не уходим в минус

        // Меняем цвет таймера к концу
        if (timeLeft <= 10) {
            timerProgressCircle.style.stroke = '#e74c3c'; // Красный
            timerText.style.color = '#e74c3c';
             timerText.style.textShadow = '0 0 10px rgba(231, 76, 60, 0.7)';
        } else if (timeLeft <= 30) {
            timerProgressCircle.style.stroke = '#f39c12'; // Оранжевый
            timerText.style.color = '#f39c12';
            timerText.style.textShadow = '0 0 10px rgba(243, 156, 18, 0.5)';
        } else {
            timerProgressCircle.style.stroke = '#3498db'; // Синий (начальный)
            timerText.style.color = '#ecf0f1';
            timerText.style.textShadow = '0 0 10px rgba(52, 152, 219, 0.5)';
        }
    }

    function updateScoreDisplay() {
        scoreDisplay.textContent = `Очки: ${score}`;
    }

    function displayVoteCounts(peaceVotes, warVotes) {
         peaceCountSpan.textContent = `За мир: ${peaceVotes !== null ? peaceVotes : '?'}`;
         warCountSpan.textContent = `Против мира: ${warVotes !== null ? warVotes : '?'}`;
         voteCountsDiv.style.display = 'block';
         voteErrorP.style.display = (peaceVotes === null || warVotes === null) ? 'block' : 'none';
    }

     // Переключение между секциями
    function switchSection(activeSection) {
         document.querySelectorAll('.section').forEach(section => {
            if (section === activeSection) {
                 section.classList.add('active-section');
            } else {
                section.classList.remove('active-section');
            }
        });
     }

    // --- Функции Анимаций и Игры ---
    function spawnAnimatedWord() {
        const word = WORDS_TO_ANIMATE[Math.floor(Math.random() * WORDS_TO_ANIMATE.length)];
        const wordElement = document.createElement('span');
        wordElement.classList.add('animated-word');
        wordElement.textContent = word;

        // Случайное позиционирование
        wordElement.style.top = `${Math.random() * 90}%`; // Не у самого края
        wordElement.style.left = `${Math.random() * 90}%`;
        wordElement.style.fontSize = `${1.5 + Math.random() * 1.5}rem`; // Разный размер
        wordElement.style.animationDuration = `${6 + Math.random() * 4}s`; // Разная скорость

        backgroundAnimationsDiv.appendChild(wordElement);

        // Удаляем слово после анимации + небольшой запас
        const timeoutId = setTimeout(() => {
             if (wordElement.parentNode) {
                 wordElement.parentNode.removeChild(wordElement);
             }
        }, parseFloat(wordElement.style.animationDuration || 8) * 1000 + 500);
         activeTimeouts.push(timeoutId);
    }

    function spawnClickerTarget() {
        const target = document.createElement('div');
        target.classList.add('clicker-target');
        target.textContent = '🎯'; // Можно использовать иконку или символ

        // Позиционируем в пределах game-area
        const areaRect = clickerGameArea.getBoundingClientRect();
        const targetSize = 40; // Размер цели
        target.style.top = `${Math.random() * (areaRect.height - targetSize)}px`;
        target.style.left = `${Math.random() * (areaRect.width - targetSize)}px`;

        // Обработчик клика
        target.onclick = () => {
            if (target.parentNode) { // Проверяем, что цель еще не удалена (например, таймаутом)
                score++;
                updateScoreDisplay();
                target.classList.add('clicked'); // Анимация исчезновения при клике
                // Удаляем после анимации клика
                setTimeout(() => {
                     if (target.parentNode) target.parentNode.removeChild(target);
                 }, 300);
                target.onclick = null; // Убираем обработчик, чтобы избежать двойных кликов
            }
        };

        clickerGameArea.appendChild(target);

        // Таймаут на удаление цели, если по ней не кликнули
        const removeTimeoutId = setTimeout(() => {
             if (target.parentNode && !target.classList.contains('clicked')) {
                 target.style.opacity = '0'; // Плавное исчезновение
                 setTimeout(() => {
                     if (target.parentNode) target.parentNode.removeChild(target);
                  }, 300);
             }
        }, TARGET_LIFETIME);
         activeTimeouts.push(removeTimeoutId);
    }


    // --- Основная Логика Таймера и Переходов ---
    function stopGameAndAnimations() {
        clearInterval(mainTimerInterval);
        clearInterval(wordSpawnInterval);
        clearInterval(targetSpawnInterval);

        // Очистить все созданные элементы и таймауты
         backgroundAnimationsDiv.innerHTML = '';
         clickerGameArea.innerHTML = '';
         activeTimeouts.forEach(clearTimeout);
         activeTimeouts = [];
    }

    function startTimerAndGame() {
        timeLeft = INITIAL_TIME;
        score = 0;
        updateTimerDisplay();
        updateScoreDisplay();
        body.className = ''; // Сброс тем

         switchSection(timerGameSection); // Показываем секцию таймера/игры

        // Запуск таймера
        mainTimerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();

            if (timeLeft < 0) {
                stopGameAndAnimations();
                // Переход к секции выбора
                switchSection(choiceSection);
                 setChoiceButtonsState(true); // Активируем кнопки выбора
            }
        }, 1000);

        // Запуск анимации слов
        spawnAnimatedWord(); // Первый запуск сразу
        wordSpawnInterval = setInterval(spawnAnimatedWord, WORD_SPAWN_INTERVAL);

        // Запуск кликер-игры
        spawnClickerTarget(); // Первая цель
        targetSpawnInterval = setInterval(spawnClickerTarget, TARGET_SPAWN_INTERVAL);
    }

    function setChoiceButtonsState(enabled) {
         peaceBtn.disabled = !enabled;
         warBtn.disabled = !enabled;
         loadingIndicatorChoice.style.display = enabled ? 'none' : 'block';
     }


    async function handleVote(choice) {
         setChoiceButtonsState(false); // Блокируем кнопки

        const counterKey = choice === 'peace' ? COUNTER_PEACE_KEY : COUNTER_WAR_KEY;
        const themeClass = choice === 'peace' ? 'peace-chosen' : 'war-chosen';
        const resultText = choice === 'peace' ? 'Вы выбрали МИР! 🕊️' : 'Вы выбрали... ДРУГУЮ СТОРОНУ! 💥'; // Усилил немного

        // 1. Инкрементируем счетчик
        await hitCounterAPI(counterKey, 'up');

        // 2. Применяем тему и показываем сообщение сразу
         body.className = themeClass; // Применить тему фона
         resultMessage.innerHTML = resultText; // Показать текстовый результат выбора
         switchSection(resultSection); // Показать секцию результата

        // 3. Запрашиваем ОБА счетчика ПОСЛЕ инкремента
         const [peaceVotes, warVotes] = await Promise.all([
            hitCounterAPI(COUNTER_PEACE_KEY, 'get'),
            hitCounterAPI(COUNTER_WAR_KEY, 'get')
        ]);

        // 4. Отображаем счетчики
        displayVoteCounts(peaceVotes, warVotes);

         // Здесь можно добавить кнопку "попробовать снова", если нужно
         // const restartBtn = document.getElementById('restartBtn');
         // if(restartBtn) restartBtn.onclick = startTimerAndGame;
    }


    // --- Добавляем Слушатели Событий ---
    peaceBtn.addEventListener('click', () => handleVote('peace'));
    warBtn.addEventListener('click', () => handleVote('war'));

    // --- Запуск ---
    startTimerAndGame(); // Начинаем все при загрузке страницы

});
