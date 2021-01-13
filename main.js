if (localStorage.getItem('inserted')) {
  username.innerText = `Log in as ${localStorage.getItem('username')} to continue`;
}

const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'
];
const SCOPES = 'https://www.googleapis.com/auth/youtube.force-ssl';

const CLIENT_ID = '601640449238-b68s3fa5mfdupib4vln6o6egdov7724f.apps.googleusercontent.com';

const quotaLimit = 9500;
totalQuota.innerText = quotaLimit;
const insertDelay = 1000;
const switchDelay = 3000;


let queue = [];
let presentVideos = [];
let inserted = [];
let playlistId = '';

const handleClientLoad = () => {
  gapi.load('client:auth2', initClient);
}

const initClient = () => {
  gapi.client
    .init({
      discoveryDocs: DISCOVERY_DOCS,
      clientId: CLIENT_ID,
      scope: SCOPES
    })
    .then(() => {
      gapi.auth2.getAuthInstance().isSignedIn.listen(updateStatus);
    });
}

const updateStatus = async (isSignedIn) => {
  if (isSignedIn) {
    window.addEventListener('beforeunload', () => {
      gapi.auth2.getAuthInstance().signOut();
    });

    loginBtn.style.display = 'none';

    if (localStorage.getItem('inserted')) {
      console.warn('restore');
      restoreState();
    } else {
      channel.style.display = 'block';
      channelIdInput.addEventListener('input', (ev) => {
        if (ev.target.value.length === 24) {
          getBtn.style.display = 'block';
        } else {
          channelIdLabel.innerText = 'Invalid channel id';
        }
      });
      console.log('Signed In');

      usedQuota.innerText = Number(usedQuota.innerText) + 3;
      const resp = await gapi.client.youtube.channels.list({
        "part": "snippet",
        "mine": true
      });
      const userData = JSON.parse(resp.body);

      const currentUsername = userData.items[0].snippet.title;
      localStorage.setItem('username', currentUsername);

      username.innerText = `Logged in as ${currentUsername}`;
    }
  }
  
}

const handleLogIn = () => {
  loginBtn.innerText = 'Waiting for authorization...';
  loginBtn.disabled = true;
  gapi.auth2.getAuthInstance().signIn();
}


const getVideos = async () => {

  hideWarning();

  uploads.innerHTML = '';
  queue = [];
  getBtn.style.display = 'none';



  const channelId = channelIdInput.value;
  localStorage.setItem('channelId', channelId);

  console.log('fetching uploads');
  usedQuota.innerText = Number(usedQuota.innerText) + 5;
  const resp = await gapi.client.youtube.channels.list({
    "part": "snippet, contentDetails",
    "id": channelId
  });

  const channelData = JSON.parse(resp.body);

  const channelName = channelData.items[0].snippet.title;
  localStorage.setItem('channelName', channelName);

  channelIdLabel.innerText = `Channel name: ${channelName}`;
  const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

  info.style.display = 'flex';

  fetchVideos(uploadsPlaylistId);
}

const fetchVideos = async (playlistId, pageToken = '') => {
  usedQuota.innerText = Number(usedQuota.innerText) + 3;
  const resp = await gapi.client.youtube.playlistItems.list({
      part: "snippet",
      maxResults: 50,
      playlistId,
      pageToken,
  });
  const respData = JSON.parse(resp.body);
  const nextPageToken = respData.nextPageToken;
  const videos = respData.items;

  queue.push(...videos);
  showVideos(videos);
  videosCount.innerText = queue.length;
  console.log('current queue length: ', queue.length);

  if (!nextPageToken) {
    console.warn('end')
    console.log(queue);
    localStorage.setItem('queue', JSON.stringify(queue));
    showPlaylists();
    
  } else {
    if (queue.length === 200) {
      warningText.innerText = 'Channel contains more than 200 uploads!';
      const yesBtn = document.createElement('button');
      yesBtn.onclick = () => {
        hideWarning();
        console.warn(pageToken);
        fetchVideos(playlistId, nextPageToken);
      }
      yesBtn.innerText = 'Go ahead';
      warningButtons.appendChild(yesBtn);
      const noBtn = document.createElement('button');
      noBtn.onclick = () => reset();
      noBtn.innerText = 'Quit';
      warningButtons.appendChild(noBtn);
      showWarning();
    } else {
      fetchVideos(playlistId, nextPageToken);
    }
  }
}

const showVideos = (videos) => {
  const temp = document.createDocumentFragment();
  videos.forEach(video => {
    const li = document.createElement('li');
    li.id = video.snippet.resourceId.videoId
    li.innerText = video.snippet.title;
    temp.appendChild(li);
  });

  uploads.appendChild(temp);
  uploads.scrollTo(0, uploads.scrollHeight);
}

const hideWarning = () => {
  warningButtons.innerHTML = '';
  if (queue.length) {
    warning.style.display = 'none';
    info.style.display = 'flex';
  }
}

const showWarning = () => {
  warning.style.display = 'block';
  info.style.display = 'none';
}

const showPlaylists = async () => {
  usedQuota.innerText = Number(usedQuota.innerText) + 3;
  const resp = await gapi.client.youtube.playlists.list({
      part: "snippet",
      mine: true,
      maxResults: 50,
    });
  const playlists = JSON.parse(resp.body).items;

  const temp = document.createDocumentFragment();

  playlists.forEach(playlist => {
    const label = document.createElement('label');
    label.setAttribute('for', playlist.id);
    label.onclick = () => {
      selectPlaylist(playlist.id, playlist.snippet.title);
    };
    label.innerText = playlist.snippet.title;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'playlist';
    radio.id = playlist.id;

    temp.appendChild(radio);
    temp.appendChild(label);
  });

  playlistsScroll.appendChild(temp);

  playlistsContainer.style.display = 'block';

  createPlaylistBtn.addEventListener('click', createPlaylist);
}

const selectPlaylist = (id, title) => {
  playlistId = id;
  addBtn.innerText = `Add ${queue.length} videos to ${title}`
  addBtn.style.display = 'block';
  localStorage.setItem('playlistId', playlistId);
}

const createPlaylist = async () => {
  if (newPlaylistName.value.length) {
    createPlaylistBtn.innerText = 'Create new';
    usedQuota.innerText = Number(usedQuota.innerText) + 53;
    const resp = await gapi.client.youtube.playlists.insert({
      "part": "snippet",
      "resource": {
        "snippet": {
          "title": newPlaylistName.value,
        }
      }
    });
    const respData = JSON.parse(resp.body);

    const label = document.createElement('label');
    label.setAttribute('for', respData.id);
    label.onclick = () => {
      selectPlaylist(respData.id, respData.snippet.title);
    };
    
    label.innerText = respData.snippet.title;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'playlist';
    radio.id = respData.id;
    radio.checked = true;
    selectPlaylist(respData.id, respData.snippet.title);

    newPlaylistContainer.style.display = 'none';

    playlistsScroll.prepend(label);
    playlistsScroll.prepend(radio);

  } else {
    ev.target.innerText = 'Name cannot be empty';
  }
}

const getPresentVideos = async (pageToken = '') => {
  usedQuota.innerText = Number(usedQuota.innerText) + 3;
  const resp = await gapi.client.youtube.playlistItems.list({
    part: "snippet",
    maxResults: 50,
    playlistId,
    pageToken,
  });
  const respData = JSON.parse(resp.body);
  console.log(respData);
  const nextPageToken = respData.nextPageToken;
  const videos = respData.items;

  presentVideos.push(...videos.map(data => data.snippet.resourceId.videoId));

  if (nextPageToken) {
    await getPresentVideos(nextPageToken);
  } else {
    console.warn('end')
  }
}

const insertAll = async () => {
  progress.style.display = 'block';

  msg.innerText = 'Processing...';
  time.innerText = 'Searching for duplicates...';

  presentVideos = [];
  await getPresentVideos();

  presentVideos = [...new Set([...presentVideos, ...inserted])]

  console.log('presentVideos');
  console.log(presentVideos);

  let index2 = 0;
  for (let [index, video] of queue.entries()) {
    const timeLeft = (queue.length - presentVideos.length - index2) * insertDelay / 1000 / 60;
    const userTime = (quotaLimit - (8 + 3 + (queue.length + presentVideos.length + index2) / 50 * 3) / 53 ) * insertDelay / 1000 / 60;
    time.innerText = `Total time left: ${timeLeft <= 3 ? Math.round(timeLeft * 60) + ' sec' : Math.round(timeLeft) + ' min'}`;
    if (timeLeft > userTime) {
      partTime.innerText = `User action required in: ${userTime <= 3 ? Math.round(userTime * 60) + ' sec' : Math.round(userTime) + ' min'}`;
    }
    progressCount.innerText =  `Inserting ${index + 1}/${queue.length}`;
    const videoId = video.snippet.resourceId.videoId;
    if (presentVideos.indexOf(videoId) === -1 && inserted.indexOf(videoId) === -1) {
      try {
        console.log('inserting ', videoId);
        usedQuota.innerText = Number(usedQuota.innerText) + 53;
        if (Number(usedQuota.innerText) >= quotaLimit) {
          msg.innerText = 'Quota limit exceeded';
            time.innerText = 'Try again tomorrow at midnight pacific time';
            localStorage.setItem('inserted', JSON.stringify(inserted));
            return;
          }
        await insert(videoId);
        index2 += 1;
      } catch (e) {
        console.error(e);
        msg.innerText = 'Error';
        console.log('break');
        break;
      }
      const videoEl = document.getElementById(videoId);
      if (videoEl) {
        videoEl.classList.add('added');
        videoEl.scrollIntoView({behavior: 'smooth', block: 'center'});
      }
      await wait(insertDelay); 
    } else {
      console.log('SKIPPING');
      const videoEl = document.getElementById(videoId);
      if (videoEl) {
        videoEl.classList.add('skipped');
        videoEl.scrollIntoView({behavior: 'smooth', block: 'center'});
      }
    }
    inserted.push(videoId);
  }

  msg.innerText = 'Checking integrity... ';

  presentVideos = [];
  await getPresentVideos();

  if (presentVideos.length >= queue.length) {
    msg.innerText = 'Done';
    time.innerText = '';
    partTime.innerText = '';
    progressCount.innerText = `Inserted ${queue.length} videos`;
    resetBtn.style.display = 'block';
    localStorage.clear();
  } else {
    insertAll();
  }

};

const add = () => {
  uploads.scrollTo(0, 0);
  addBtn.style.display = 'none';
  playlistsContainer.style.display = 'none';

  const checkQuota = () => {
    if (queue.length * 53 >= 9500) {

      warningText.innerText = `Operation cost exceeds avaible quota by ${quotaLimit - Number(usedQuota.innerText) - queue.length * 53 }.`;
      const yesBtn = document.createElement('button');
      yesBtn.onclick = () => {
        hideWarning();
        insertAll();
      }
      yesBtn.innerText = 'Do as much as you can';
      warningButtons.appendChild(yesBtn);
      const noBtn = document.createElement('button');
      noBtn.onclick = () => {
        reset();
      };
      noBtn.innerText = 'Quit';
      warningButtons.appendChild(noBtn);
      showWarning();
    } else {
      insertAll();
    }
  }

  if (queue.length < 200) {
    checkQuota();
  } else {
    warningText.innerText = 'Queue contains more than 200 videos!';
    const yesBtn = document.createElement('button');
    yesBtn.onclick = () => {
      hideWarning();
      checkQuota();
    }
    yesBtn.innerText = 'Go ahead';
    warningButtons.appendChild(yesBtn);
    const noBtn = document.createElement('button');
    noBtn.onclick = () => {
      reset();
    };
    noBtn.innerText = 'Quit';
    warningButtons.appendChild(noBtn);
    showWarning();
  }
}

const insert = (videoId) => {
  gapi.client.youtube.playlistItems.insert({
    "part": "snippet",
    "resource": {
      "snippet": {
        "playlistId": playlistId,
        "resourceId": {
          "kind": "youtube#video",
          "videoId": videoId
        }
      }
    }
  }).then(() => {
    return;
  }).catch((e) => {
    throw new Error(e);
  });

  console.log('inserted');
}

const restoreState = () => {
  username.innerText = `Logged in as ${localStorage.getItem('username')}`;
  channelIdLabel.innerText = `Channel name: ${localStorage.getItem('channelName')}`;
  channelIdInput.value = localStorage.getItem('channelId');
  channelId = localStorage.getItem('channelId');
  playlistId = localStorage.getItem('playlistId');
  queue = JSON.parse(localStorage.getItem('queue'));
  inserted = JSON.parse(localStorage.getItem('inserted'));
  console.log('inserted list');
  console.log(inserted);
  uploads.setAttribute('start', inserted.length + 1);
  showVideos(queue.slice(inserted.length));
  uploads.scrollTo(0, 0);
  progress.style.display = 'block';
  info.style.display = 'block';
  insertAll();

}

const reset = () => {
  resetBtn.style.display = 'none';
  hideWarning();
  queue = [];
  uploads.style.display = 'block';
  uploads.innerHTML = '';
  playlistId = '';
  channelIdInput.value = '';
  channelIdLabel.innerText = 'Paste here channel id';
  getBtn.style.display = 'block;'
  channel.style.display = 'block';
  progressCount.innerText = '';
  msg.innerText = '';
  time.innerText = '';
  videosCount.innerText = '2';
  info.style.display = 'none';
}

const wait = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}