const sendBtn = document.querySelector(".main__send");
const promptInput = document.querySelector(".main__prompt");
const modelSelect = document
  .querySelector(".main__chooseModel")
  .querySelector("select");
const imageCont = document.querySelector(".main__imgCont");
const imageContTitle = document.querySelector(".imgCont__title");
const imageContInput = document
  .querySelector(".main__imgCont")
  .querySelector("input");
const responseDiv = document.querySelector(".main__answer");
const imageContPreview = document.querySelector(".imgCont__imgPreview");
let imageURL = null;

async function getFromStorage(key) {
  return await new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result.key);
    });
  });
}

imageCont.setAttribute("tabindex", "0");

// Обработчики фокуса при наведении
imageCont.addEventListener("mouseenter", () => {
  imageCont.focus();
});

imageCont.addEventListener("mouseleave", () => {
  imageCont.blur();
});

// Обработчик вставки из буфера
imageCont.addEventListener("paste", async (e) => {
  e.preventDefault();

  // Получаем данные из буфера
  const items = e.clipboardData.items;
  for (let item of items) {
    if (item.type.startsWith("image/")) {
      try {
        imageContTitle.textContent = "Uploading from clipboard...";

        // Получаем файл изображения
        const file = item.getAsFile();

        // Загружаем на ImgBB
        const url = await uploadToImgBB(file);

        // Сохраняем в хранилище
        imageURL = url;

        imageContTitle.textContent = "RESET";
        imageContPreview.src = url;
        imageContPreview.style.display = "block";

        return; // Выходим после первой найденной картинки
      } catch (error) {
        imageCont.textContent = "Paste failed!";
        console.error("Paste error:", error);
      }
    }
  }

  // Если не нашли изображение
  imageCont.textContent = "No image in clipboard!";
  setTimeout(() => {
    imageCont.textContent = "IMAGE";
  }, 2000);
});

imageCont.addEventListener("click", () => {
  if (imageURL) {
    imageContTitle.textContent = "IMAGE";
    imageContPreview.src = "";
    imageContPreview.style.display = "none";
    imageURL = null;
  } else {
    imageContInput.click();
  }
});

imageContInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    // Показываем загрузку
    imageContTitle.textContent = "Uploading...";

    // Загружаем на ImgBB
    const url = await uploadToImgBB(file);

    // Сохраняем в хранилище
    imageURL = url;

    // Обновляем интерфейс
    imageContTitle.textContent = "RESET";
    imageContPreview.src = url;
    imageContPreview.style.display = "block";
  } catch (error) {
    imageCont.textContent = "Upload failed!";
    console.error("Upload error:", error);
  }
});

async function uploadToImgBB(file) {
  const API_KEY = "d09f62464c00ff084f1d0c8b14ce0e2b";
  const endpoint = "https://api.imgbb.com/1/upload";

  const formData = new FormData();
  formData.append("key", API_KEY);
  formData.append("image", file);

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Upload failed");

  const data = await response.json();
  return data.data.url;
}

var loadingAnimation;
function toggleLoadingAnimation() {
  if (!loadingAnimation) {
    sendBtn.textContent = "LOADING";
    loadingAnimation = setInterval(() => {
      if (
        !sendBtn.textContent.match(/\./g) ||
        sendBtn.textContent.match(/\./g).length < 3
      ) {
        sendBtn.textContent += ".";
      } else {
        sendBtn.textContent = "LOADING";
      }
    }, 500);
  } else {
    clearInterval(loadingAnimation);
    loadingAnimation = null;
    sendBtn.textContent = "SEND";
  }
}

let isProcessing = false;
sendBtn.addEventListener("click", async () => {
  if (isProcessing) return;
  isProcessing = true;
  toggleLoadingAnimation();
  const prompt = promptInput.value.trim();
  if (!prompt) return;
  let model = modelSelect.value;

  if (imageURL) {
    model = "gpt-4o";
    modelSelect.value = "gpt-4o";
  }

  responseDiv.textContent = "";
  try {
    const result = await chrome.runtime.sendMessage({
      action: "getAnswer",
      prompt,
      model,
      imageURL,
    });
    responseDiv.append(insertResult(result));
  } catch (e) {
    responseDiv.textContent = `Ошибка: ${e.message}`;
  } finally {
    toggleLoadingAnimation();
    isProcessing = false;
  }
});

function insertResult(input) {
  const escapeHtml = (unsafe) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const processText = (text) => {
    const escaped = escapeHtml(text);
    return escaped.replace(/ /g, "&nbsp;").replace(/\n/g, "<br>");
  };

  const createCodeBlock = (lang, codeContent) => {
    const codeBlock = document.createElement("div");
    codeBlock.className = "code-block";

    const header = document.createElement("div");
    header.className = "code-header";

    const langSpan = document.createElement("span");
    langSpan.className = "code-lang";
    langSpan.textContent = lang;

    const copyButton = document.createElement("button");
    copyButton.className = "copy-button";
    copyButton.textContent = "Скопировать";

    header.appendChild(langSpan);
    header.appendChild(copyButton);

    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = codeContent
      .replace(/^\n+/, "") // Удаляем начальные переносы
      .replace(/\n+$/, ""); // Удаляем конечные переносы
    pre.appendChild(code);

    codeBlock.appendChild(header);
    codeBlock.appendChild(pre);

    copyButton.addEventListener("click", () => {
      navigator.clipboard
        .writeText(codeContent)
        .then(() => {
          copyButton.textContent = "Скопировано!";
          copyButton.style.background = "#22a488";
          setTimeout(() => {
            copyButton.textContent = "Скопировать";
            copyButton.style.background = "#1f7bad";
          }, 2000);
        })
        .catch((err) => {
          console.error("Ошибка копирования:", err);
        });
    });

    return codeBlock;
  };

  const container = document.createElement("div");

  // Разбиваем текст на части
  const parts = input.split(/(```\s*\w+\s*\n[\s\S]*?```)/g);

  parts.forEach((part) => {
    if (!part) return;

    if (part.startsWith("```")) {
      const match = part.match(/```\s*(\w+)\s*\n([\s\S]*?)```/);
      if (match) {
        const lang = match[1];
        const code = match[2];
        container.appendChild(createCodeBlock(lang, code));
      }
    } else {
      const processed = processText(part);
      const node = document.createElement("div");
      node.innerHTML = processed;
      container.appendChild(node);
    }
  });

  return container;
}
