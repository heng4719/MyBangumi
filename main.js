var bangumi = require('./js/updateBangumi')
var mysql = require('mysql');

const Mirai = require('node-mirai-sdk');
const { Plain, At } = Mirai.MessageComponent;

var con = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '123456',
    database : 'bangumi'
  });     
con.connect();

//更新资源并自动发布更新消息@用户
// bangumi.updateBangumi(null, con);

// debugger;
const bot = new Mirai({
  // host: 'http://budeliao.top:8082',
  host: 'http://127.0.0.1:8082',
  verifyKey: 'INITKEYEC6eueUp',
  qq: 570918181,
  enableWebsocket: true,
  wsOnly: true,
});

// auth 认证(*)
bot.onSignal('authed', () => {
  console.log(`Authed with session key ${bot.sessionKey}`);
  bot.verify();
});

// session 校验回调
bot.onSignal('verified', async () => {
  console.log(`Verified with session key ${bot.sessionKey}`);

  // 获取好友列表，需要等待 session 校验之后 (verified) 才能调用 SDK 中的主动接口
  const friendList = await bot.getFriendList();
  console.log(`There are ${friendList.length} friends in bot`);
});

// 接受消息,发送消息(*)
bot.onMessage(async message => {
  const { type, sender, messageChain, reply, quoteReply } = message;
  let msg = '';
  messageChain.forEach(chain => {
    if (chain.type === 'Plain')
        msg += Plain.value(chain);       // 从 messageChain 中提取文字内容
  });
  console.log("msg: ", msg)
  console.log("sender: ", sender)

  
  if (msg.includes('bgm')){
    console.log("开始查询番剧更新情况")
    bangumi.updateBangumi(con).then(function(res){    
      console.log("res ", res)
      if(res.hasUpdate){
        let actions = [
          Plain(res.msg)
        ]
        res.users.forEach(qq => {
          actions.push(At(qq))
        });
        reply(actions, message);
      }else {
        reply([Plain("很遗憾，并没有番剧更新捏"), At(sender.id)], message);
      }
    })
  }

  if(msg.includes('setu')){        
    reply('别急，你先别急');  
  }

  if(msg.includes('getUpdate')){    
    bangumi.getUpdateInfo(con, sender.id).then(function(result){      
      console.log("getUpdateInfo: ", result)
      bot.quoteReply([Plain(result)], message); // 引用消息
    });    
  }

  // 直接回复
  if (msg.includes('收到了吗'))
    reply('收到了收到了');                          // 或者: bot.reply('收到了收到了', message)
  // 引用回复
  else if (msg.includes('引用我'))
    quoteReply([At(sender.id), Plain('好的')]);     // 或者: bot.quoteReply(messageChain, message)
  // 撤回消息
  else if (msg.includes('撤回'))
    bot.recall(message);
  // 发送图片，参数接受图片路径或 Buffer
  else if (msg.includes('来张图'))
    bot.sendImageMessage("./image.jpg", message);
});

/* 开始监听消息(*)
 * 'all' - 监听好友和群
 * 'friend' - 只监听好友
 * 'group' - 只监听群
 * 'temp' - 只监听临时会话
*/
bot.listen('all'); // 相当于 bot.listen('friend', 'group', 'temp')

// 退出前向 mirai-http-api 发送释放指令(*)
process.on('exit', () => {
  bot.release();
});