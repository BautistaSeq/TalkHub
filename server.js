const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));
app.use(express.json());

// subida archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// DB segura
function loadMessages(){
  if(!fs.existsSync("messages.json")){
    return {general:[], private:{}};
  }
  return JSON.parse(fs.readFileSync("messages.json"));
}
function saveMessages(data){
  fs.writeFileSync("messages.json", JSON.stringify(data,null,2));
}

// LOGIN
app.post("/login",(req,res)=>{
  const {gmail,dni}=req.body;
  const users=JSON.parse(fs.readFileSync("users.json"));
  const user=users.find(u=>u.gmail===gmail && u.dni===dni);
  res.json(user?{success:true,nombre:user.nombre}:{success:false});
});

// mensajes
app.get("/messages",(req,res)=>{
  res.json(loadMessages());
});

// subir
app.post("/upload",upload.single("file"),(req,res)=>{
  res.json({file:req.file.filename});
});

// borrar mensaje
app.post("/deleteMessage",(req,res)=>{
  let db=loadMessages();
  let {id,chat,user,to}=req.body;

  if(chat==="general"){
    db.general=db.general.filter(m=>m.id!==id);
  }else{
    let key=[user,to].sort().join("-");
    if(db.private[key]){
      db.private[key]=db.private[key].filter(m=>m.id!==id);
    }
  }

  saveMessages(db);
  res.json({ok:true});
});

// borrar chat
app.post("/deleteChat",(req,res)=>{
  let db=loadMessages();
  let {chat,user,to}=req.body;

  if(chat==="general"){
    db.general=[];
  }else{
    let key=[user,to].sort().join("-");
    delete db.private[key];
  }

  saveMessages(db);
  res.json({ok:true});
});

// sockets
io.on("connection",(socket)=>{

  function addId(d){
    d.id=Date.now()+Math.random();
    return d;
  }

  socket.on("general message",(d)=>{
    let db=loadMessages();
    d=addId(d);
    db.general.push(d);
    saveMessages(db);
    io.emit("general message",d);
  });

  socket.on("private message",(d)=>{
    let db=loadMessages();
    d=addId(d);

    let key=[d.user,d.to].sort().join("-");
    if(!db.private[key]) db.private[key]=[];

    db.private[key].push(d);
    saveMessages(db);

    io.emit("private message",d);
  });

  socket.on("file message",(d)=>{
    let db=loadMessages();
    d=addId(d);

    if(d.chat==="general"){
      db.general.push(d);
    }else{
      let key=[d.user,d.to].sort().join("-");
      if(!db.private[key]) db.private[key]=[];
      db.private[key].push(d);
    }

    saveMessages(db);
    io.emit("file message",d);
  });

});

server.listen(3000,()=>console.log("http://localhost:3000"));