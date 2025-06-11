document.getElementById('domain').innerText = window.location.hostname;

// Асинхронная функция для вычисления SHA‑256 хеша от строки (challenge + nonce)
async function computeHashAsync(challenge, nonce) {
  const text = challenge + nonce.toString();
  const msg = new TextEncoder().encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msg);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Асинхронная функция для поиска подходящего nonce пакетами
async function findValidNonceAsync(challenge, difficulty, batchSize = 200) {
  let nonce = 0;
  const targetPrefix = '0'.repeat(difficulty);
  while (true) {
    const nonces = [];
    for (let i = 0; i < batchSize; i++) {
      nonces.push(nonce + i);
    }
    const promises = nonces.map(n => computeHashAsync(challenge, n));
    const hashes = await Promise.all(promises);
    for (let i = 0; i < hashes.length; i++) {
      if (hashes[i].startsWith(targetPrefix)) {
        return { nonce: nonces[i], hash: hashes[i] };
      }
    }
    nonce += batchSize;
  }
}

// Функция для изменения сообщения на странице
function changeMessage(text) {
  const message = document.querySelector('.message');
  if (message.textContent === text) return;
  message.style.animationName = 'FID';
  setTimeout(() => {
    message.textContent = text;
    message.style.animationName = 'FIP';
  }, 500);
}

// Функция-решатель PoW: вычисляет валидный nonce по заданной сложности и возвращает объект с nonce и prefix
const runSolver = async (difficulty, prefix) => {
  const result = await findValidNonceAsync(prefix, difficulty);
  // Преобразуем найденное число nonce в строку (десятичное представление)
  const nonceStr = result.nonce.toString();
  changeMessage("Отправка результатов");
  return { nonce: nonceStr, prefix };
};

// Функция для отправки результата PoW на сервер
const sendResult = async (result, redirect) => {
  const fingerprint = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    languages: navigator.languages,
    webdriver: navigator.webdriver,
    plugins: [...navigator.plugins].map(p => p.name),
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth
    }
  };
  try {
    const response = await fetch("/shield", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ...result, redirect , fingerprint})
    });
    window.responseStatus = response.status;
    window.nonceSent = true;
    if (response.status === 200) {
      setInterval(() => {
        changeMessage("Перенаправляю...");
      }, 500);
      setInterval(() => {
        window.location.href = redirect ? redirect : "/";
      }, 3000);
    } else {
      setInterval(() => {
        changeMessage("Проверка не удалась. Повторяю попытку");
      }, 500);
      setInterval(() => {
        window.location.reload();
      }, 3000);
    }
  } catch (err) {
    console.error("Error", err);
  }
};

// Инициализация: запускается через window.init с параметрами, подставляемыми из HTML-шаблона
window.init = (difficulty, prefix, redirect) => {
  setTimeout(async () => {
    const result = await runSolver(difficulty, prefix);
    setTimeout(async () => {
      await sendResult(result, redirect);
    }, 500);
  }, 1500);
};
