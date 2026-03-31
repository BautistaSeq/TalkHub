const socket = io();
let user = localStorage.getItem("user");
let current = "general";

loadMessages();

msg.onkeydown=e=>{if(e.key==="Enter")send();};

function setChat(name,el){
  current=name;
  document.querySelectorAll(".chatBtn").forEach(b=>b.classList.remove("active"));
  el.classList.add("active");
  loadMessages();
}

// enviar
function send(){
  let text=msg.value.trim();
  if(!text) return;

  let data={user,text,chat:current};

  if(current==="general") socket.emit("general message",data);
  else{
    data.to=current;
    socket.emit("private message",data);
  }

  msg.value="";
}

// archivo
function sendFile(){
  let f=file.files[0];
  if(!f) return;

  let form=new FormData();
  form.append("file",f);

  fetch("/upload",{method:"POST",body:form})
  .then(r=>r.json())
  .then(d=>{
    let data={user,file:d.file,chat:current};
    if(current!=="general") data.to=current;
    socket.emit("file message",data);
  });
}

// audio
let rec,chunks=[];
async function startRec(){
  let stream=await navigator.mediaDevices.getUserMedia({audio:true});
  rec=new MediaRecorder(stream);

  rec.ondataavailable=e=>chunks.push(e.data);

  rec.onstop=()=>{
    let blob=new Blob(chunks);
    chunks=[];

    let form=new FormData();
    form.append("file",blob,"audio.webm");

    fetch("/upload",{method:"POST",body:form})
    .then(r=>r.json())
    .then(d=>{
      let data={user,file:d.file,chat:current};
      if(current!=="general") data.to=current;
      socket.emit("file message",data);
    });
  };

  rec.start();
}
function stopRec(){ if(rec) rec.stop(); }

// borrar mensaje
function deleteMsg(d){
  fetch("/deleteMessage",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      id:d.id,
      chat:current,
      user,
      to:current
    })
  }).then(()=>loadMessages());
}

// borrar chat
function deleteChat(){
  fetch("/deleteChat",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      chat:current,
      user,
      to:current
    })
  }).then(()=>loadMessages());
}

// cargar
function loadMessages(){
  fetch("/messages")
  .then(r=>r.json())
  .then(db=>{
    messages.innerHTML="";

    let list=current==="general"
      ? db.general
      : db.private[[user,current].sort().join("-")]||[];

    list.forEach(addMsg);
    scroll();
  });
}

// sockets
socket.on("general message",d=>{
  if(current==="general"){ addMsg(d); sound(); scroll(); }
});
socket.on("private message",d=>{
  if(current===d.chat||current===d.to){ addMsg(d); sound(); scroll(); }
});
socket.on("file message",d=>{
  if(current!==d.chat) return;
  addMsg(d); sound(); scroll();
});

// sonido
function sound(){
  notifSound.play().catch(()=>{});
}

// scroll
function scroll(){
  messages.scrollTop=messages.scrollHeight;
}

// mostrar
function addMsg(d){
  let div=document.createElement("div");
  div.className="msg "+(d.user===user?"me":"other");

  div.innerHTML="<b>"+d.user+":</b> "+(d.text||"");

  if(d.user===user){
    let del=document.createElement("span");
    del.innerText="🗑";
    del.className="deleteBtn";
    del.onclick=()=>deleteMsg(d);
    div.appendChild(del);
  }

  if(d.file){
    let url="uploads/"+d.file;
    let ext=d.file.split(".").pop().toLowerCase();

    if(["png","jpg","jpeg"].includes(ext)){
      let img=document.createElement("img");
      img.src=url;
      img.style.maxWidth="200px";
      div.appendChild(img);
    }
    else{
      let a=document.createElement("a");
      a.href=url;
      a.innerText="Archivo";
      a.target="_blank";
      div.appendChild(a);
    }
  }

  messages.appendChild(div);
}