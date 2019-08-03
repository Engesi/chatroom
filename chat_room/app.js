// koa 解析请求体数据  登录，koa-session
// koa-static  koa-router art-template

const Koa = require('koa');
const Router = require('koa-router');
const static = require('koa-static');
const render = require('koa-art-template');
const path = require('path');
const session = require('koa-session');
const bodyparser = require('koa-bodyparser');
//mongodb数据库
const MongoClient = require('mongodb').MongoClient;
const url = 'mongodb://localhost:27017';

const dbName = 'users';
var doc=[];
const MySession={};
const groups={'malegroup':'男生组','femalegroup':'女生组'};
const fuck={}
function FindIdBySocketId(socketid){
	for(var i in MySession){
		if(MySession[i].socketid===socketid){
			return i
		}
	}
}
let app = new Koa();

// 加入socket.io 开始
const IO = require( 'koa-socket' )

const io = new IO()
io.attach(app)
io.on('connection',context=>{
	console.log('连接上了')
})
io.on('login',context=>{
	let id=context.data.id;
	let socketid=context.socket.socket.id;
	console.log(socketid)
	MySession[id].socketid=socketid;
	console.log(MySession);
	io.broadcast('online',MySession);
	
	
	
	
})
io.on('disconnect',context=>{
	  // 删除掉原本存在的id的用户
	  // 获取到socketid
	  let socketid = context.socket.socket.id;
	  let id = FindIdBySocketId(socketid);
	  // 删除id
	  delete MySession[id];
	  io.broadcast('online',
	    MySession
	  );
	})
io.on('sendMsg',context=>{
	let msg=context.data.msg;
	console.log(context.socket.socket.id)
	let username=MySession[FindIdBySocketId(context.socket.socket.id)].username;

	 io.broadcast('fanhui',{
	  msg:`<li><span class="span1">${username}</span>说:<span class="span2">${msg}</span></li>`
	}); 
})
//服务器接收私聊
io.on('siliao',context=>{
	let prvmsg=context.data.prvmsg;
	let socketid=context.socket.socket.id;
	let prvTo=context.data.prvTo;//prvTo是被发送用户的socketid
	let username=MySession[FindIdBySocketId(socketid)].username;
	app._io.to(prvTo).emit('prvchat',{
		msg:`<li><span class="span1">${username}</span>对您说:<span class="span2">${prvmsg}</span></li>`
	});
	app._io.to(socketid).emit('prvchat',{
		msg:`<li>您对<span class="span1">${MySession[FindIdBySocketId(prvTo)].username}</span>说:
		<span class="span2">${prvmsg}</span></li>`
	});
})
io.on('joingroup',context=>{
	context.socket.socket.join(context.data.group)
})
io.on('groupsend',context=>{
	let groupmsg=context.data.groupmsg;
	let socketid=context.socket.socket.id;
	let group=context.data.qun;
	let username=MySession[FindIdBySocketId(socketid)].username;
	app._io.to(group).emit('qunfa',{
		groupmsg:`<li>
		<span class="span1">${username}</span>对<span class="span1">${groups[group]}</span>说:
		<span class="span2">${groupmsg}</span>
		</li>`
	})
})
render(app, {
  // 页面查找的目录
  root: path.join(__dirname, 'views'),
  // 设置后缀名
  extname: '.html',
  // debug: false 则每次压缩页面及js，包括混淆，静态数据不会实时更新（不每次都读文件)
  debug: process.env.NODE_ENV !== 'production'
});

let router=new Router();
router
.get('/',ctx=>{
	ctx.render('index')
})
.post('/login',ctx=>{
	let username=ctx.request.body.username;
	let password=ctx.request.body.password;
	ctx.session.user={username};
	let id=Date.now();
	console.log(id);
	ctx.session.user.password=password;
	MySession[id]={username};
	ctx.session.user.id=id;
	ctx.redirect('/chaxun');
})
.post('/register',ctx=>{
	ctx.render('register')
})
.get('/list',ctx=>{
	ctx.render('list',{
		username:ctx.session.user.username,
		id:ctx.session.user.id,
		msg:ctx.session.user.msg
	})
})
.get('/chaxun',async ctx=>{
		await new Promise ((resolve,reject)=>{
			
			MongoClient.connect(url,function(err,client){
				if(err){
					reject(err);
					return;
				} 
				const col=client.db('users').collection('users2');
				col.find({username:ctx.session.user.username}).toArray(function(err,docs){
					if(err) {
						reject(console.log('用户名不存在，请注册'));
						return;
					}
					/* res.json({"code":"2000","data":docs}) */
					resolve(doc=docs)
					/* console.log(docs);
					doc=docs;
					client.close(); */
				})
			})
		
		})
		if(doc[0].password===ctx.session.user.password){
			ctx.session.user.msg=doc[0].msg;
			ctx.redirect('/list')
		}else{
			ctx.body='密码输入错误，请重新输入'
		}
		})
.post('/insert',async ctx=>{
	
	await new Promise((resolve,reject)=>{
		let username=ctx.request.body.username;
		let password=ctx.request.body.password;
		let msg=ctx.request.body.msg;
		MongoClient.connect(url,(err,client)=>{
			if(err){
				reject(err);
				return;
			}
			const col=client.db('users').collection('users2');
			col.insert([{username,password,msg}],(err,result)=>{
				if (err){
					reject(err);
					return;
				}
				resolve(console.log(result))
				client.close();
				
			})
		}) ;
	}) 
	
	ctx.body='注册成功，3秒后返回登录页面';
	ctx.redirect('/')
})
// 接收用户的消息

app.keys = ['test'];

// 在服务器内存中存储 {session_id:用户数据}
let store = {
  myStore:{},
  get:function(key) {
    return this.myStore[key];
  },
  set:function(key,session) {
    this.myStore[key] = session;
  },
  destroy:function() {
    delete this.myStore[key];
  }
}
// 处理静态资源
app.use(static(path.resolve('./public')));
// 处理session
app.use(session({store},app,))
// 处理请求体数据
app.use(bodyparser());
// 路由
app.use(router.routes());
// 处理405 501
app.use(router.allowedMethods());


app.listen(8888,console.log('服务器在8888端口启动了'));