// モード切り替え
document.querySelectorAll('input[name="searchMode"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const mode = e.target.value;
    document.getElementById('pageOptions').classList.toggle('hidden', mode !== 'page');
    document.getElementById('scrollOptions').classList.toggle('hidden', mode !== 'scroll');
  });
});

document.getElementById('startSearch').addEventListener('click', async () => {
  const keyword = document.getElementById('keyword').value.trim();
  const searchMode = document.querySelector('input[name="searchMode"]:checked').value;

  if (!keyword) {
    showStatus('キーワードを入力してください', 'error');
    return;
  }

  // ボタンの表示切り替え
  document.getElementById('startSearch').style.display = 'none';
  document.getElementById('stopSearch').style.display = 'block';

  // 現在のタブを取得
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (searchMode === 'page') {
    const maxPages = parseInt(document.getElementById('maxPages').value);

    if (maxPages < 1) {
      showStatus('最大ページ数は1以上を指定してください', 'error');
      document.getElementById('startSearch').style.display = 'block';
      document.getElementById('stopSearch').style.display = 'none';
      return;
    }

    // 検索設定を保存
    await chrome.storage.local.set({
      searchActive: true,
      searchMode: 'page',
      keyword: keyword,
      maxPages: maxPages,
      currentPage: 0,
      startUrl: tab.url
    });

    showStatus('検索を開始します...', 'info');

    // Content Scriptに検索開始を通知
    chrome.tabs.sendMessage(tab.id, {
      action: 'startSearch',
      searchMode: 'page',
      keyword: keyword,
      maxPages: maxPages
    });
  } else {
    // スクロールモード
    const maxScrollTop = parseInt(document.getElementById('maxScrollTop').value);

    if (maxScrollTop < 100) {
      showStatus('最大スクロール位置は100以上を指定してください', 'error');
      document.getElementById('startSearch').style.display = 'block';
      document.getElementById('stopSearch').style.display = 'none';
      return;
    }

    // 検索設定を保存
    await chrome.storage.local.set({
      searchActive: true,
      searchMode: 'scroll',
      keyword: keyword,
      maxScrollTop: maxScrollTop,
      currentScrollTop: 0,
      startUrl: tab.url
    });

    showStatus('スクロール検索を開始します...', 'info');

    // Content Scriptに検索開始を通知
    chrome.tabs.sendMessage(tab.id, {
      action: 'startSearch',
      searchMode: 'scroll',
      keyword: keyword,
      maxScrollTop: maxScrollTop
    });
  }
});

document.getElementById('stopSearch').addEventListener('click', async () => {
  await chrome.storage.local.set({ searchActive: false });

  document.getElementById('startSearch').style.display = 'block';
  document.getElementById('stopSearch').style.display = 'none';

  showStatus('検索を停止しました', 'info');
});

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = type;
}

// ページ読み込み時に検索状態を確認
chrome.storage.local.get(['searchActive', 'searchMode', 'currentPage', 'maxPages', 'currentScrollTop', 'maxScrollTop'], (data) => {
  // 保存済みの値を入力欄に復元
  if (data.maxScrollTop !== undefined) {
    document.getElementById('maxScrollTop').value = data.maxScrollTop;
  }
  if (data.maxPages !== undefined) {
    document.getElementById('maxPages').value = data.maxPages;
  }

  if (data.searchActive) {
    document.getElementById('startSearch').style.display = 'none';
    document.getElementById('stopSearch').style.display = 'block';

    if (data.searchMode === 'scroll') {
      showStatus(`スクロール検索中... (${data.currentScrollTop || 0}/${data.maxScrollTop || 0} px)`, 'info');
    } else {
      showStatus(`検索中... (${data.currentPage || 0}/${data.maxPages || 0} ページ)`, 'info');
    }
  }
});

// ステータス更新を監視
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.searchActive && !changes.searchActive.newValue) {
      document.getElementById('startSearch').style.display = 'block';
      document.getElementById('stopSearch').style.display = 'none';
    }

    if (changes.currentPage || changes.currentScrollTop || changes.searchStatus) {
      chrome.storage.local.get(['searchMode', 'currentPage', 'maxPages', 'currentScrollTop', 'maxScrollTop', 'searchStatus'], (data) => {
        if (data.searchStatus) {
          showStatus(data.searchStatus, 'info');
        } else if (data.searchMode === 'scroll' && data.currentScrollTop !== undefined) {
          showStatus(`スクロール検索中... (${data.currentScrollTop}/${data.maxScrollTop} px)`, 'info');
        } else if (data.currentPage !== undefined) {
          showStatus(`検索中... (${data.currentPage}/${data.maxPages} ページ)`, 'info');
        }
      });
    }
  }
});
