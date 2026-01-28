document.getElementById('startSearch').addEventListener('click', async () => {
  const keyword = document.getElementById('keyword').value.trim();
  const maxPages = parseInt(document.getElementById('maxPages').value);
  
  if (!keyword) {
    showStatus('キーワードを入力してください', 'error');
    return;
  }
  
  if (maxPages < 1) {
    showStatus('最大ページ数は1以上を指定してください', 'error');
    return;
  }
  
  // ボタンの表示切り替え
  document.getElementById('startSearch').style.display = 'none';
  document.getElementById('stopSearch').style.display = 'block';
  
  // 現在のタブを取得
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // 検索設定を保存
  await chrome.storage.local.set({
    searchActive: true,
    keyword: keyword,
    maxPages: maxPages,
    currentPage: 0,
    startUrl: tab.url
  });
  
  showStatus('検索を開始します...', 'info');
  
  // Content Scriptに検索開始を通知
  chrome.tabs.sendMessage(tab.id, {
    action: 'startSearch',
    keyword: keyword,
    maxPages: maxPages
  });
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
chrome.storage.local.get(['searchActive', 'currentPage', 'maxPages'], (data) => {
  if (data.searchActive) {
    document.getElementById('startSearch').style.display = 'none';
    document.getElementById('stopSearch').style.display = 'block';
    showStatus(`検索中... (${data.currentPage || 0}/${data.maxPages || 0} ページ)`, 'info');
  }
});

// ステータス更新を監視
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.searchActive && !changes.searchActive.newValue) {
      document.getElementById('startSearch').style.display = 'block';
      document.getElementById('stopSearch').style.display = 'none';
    }
    
    if (changes.currentPage || changes.searchStatus) {
      chrome.storage.local.get(['currentPage', 'maxPages', 'searchStatus'], (data) => {
        if (data.searchStatus) {
          showStatus(data.searchStatus, 'info');
        } else if (data.currentPage !== undefined) {
          showStatus(`検索中... (${data.currentPage}/${data.maxPages} ページ)`, 'info');
        }
      });
    }
  }
});
