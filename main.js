var bangumi = require('./js/updateBangumi')
var httpServer = require('./js/httpServer')
var mysql = require('mysql');

const Mirai = require('node-mirai-sdk');
const { Plain, At } = Mirai.MessageComponent;

let NoticeGroup = []

//初始化数据库
var con = InitDataBase();
//初始化机器人
var bot = InitMiraiBot();
//初始化接口服务
httpServer.InitHttpServer(con);

//注册事件
bot.onMessage(async message => {
  const { type, sender, messageChain, reply, quoteReply } = message;
  let msg = '';
  messageChain.forEach(chain => {
    if (chain.type === 'Plain')
        msg += Plain.value(chain);       // 从 messageChain 中提取文字内容
  });
  console.log("msg: ", msg)
  console.log("sender: ", sender)

  //------------------------------------------
  //-----------------番剧订阅 Start------------
  //------------------------------------------
  //主动查询番剧更新情况
  if (msg.includes('更新资源')){
    console.log("开始查询番剧更新情况")
    DealBangumiUpdate(reply, message, true);
  }
  //开启订阅通知
  if (msg.includes('开启订阅通知')){
    console.log("开启订阅通知")
    //检查是否已开启
    if(NoticeGroup.filter(function(item){
      return item.groupId == sender.group.id
    }).length == 0) {
      let interval = setInterval( function(){ DealBangumiUpdate(reply, message, false)}, 1000 * 60 * 5); //每1分钟拉取一次
      NoticeGroup.push({
        groupId: sender.group.id,
        interval: interval
      })
      if(interval) reply('订阅通知已开启');
    }else{
      reply('本群已开启订阅通知，憋重复发命令');
    }
  }
  //查询该用户订阅的所有新番的最新一集
  if(msg.includes('最新一集')){
    bangumi.getUpdateInfo(con, sender.id).then(function(result){
      bot.quoteReply([Plain(result)], message);
    });    
  }

  if(msg.includes('订阅管理')){
    let returnMsg = `目前仅提供网页端订阅管理功能，你的管理页面:http://budeliao.top/bangumi/subscribe?qq=${sender.id}`
    reply(returnMsg);
  }

  if(msg.includes('订阅列表')){
    bangumi.querySubscribeList(con, sender.id).then(msg => {
      quoteReply([Plain(msg)]);
    })
  }
  //------------------------------------------
  //-----------------番剧订阅 End--------------
  //------------------------------------------

  if(msg.includes('LDS') || msg.includes('lds')){        
    // reply('LDS功能正在绝赞开发中');
  }
  if(msg.includes('setu')){        
    reply('别急，你先别急');
  }
  // 直接回复
  // if (msg.includes('收到了吗'))
  //   reply('收到了收到了'); // 或者: bot.reply('收到了收到了', message)
  // // 引用回复
  // else if (msg.includes('引用我'))
  //   quoteReply([At(sender.id), Plain('好的')]); // 或者: bot.quoteReply(messageChain, message)
  // // 撤回消息
  // else if (msg.includes('撤回'))
  //   bot.recall(message);
  // // 发送图片，参数接受图片路径或 Buffer
  // else if (msg.includes('来张图'))
  //   bot.sendImageMessage("./image.jpg", message);
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

function InitDataBase(){
  var con = mysql.createConnection({
      host     : 'localhost',
      user     : 'root',
      password : '123456',
      database : 'bangumi'
    });     
  con.connect();
  return con;
}

function InitMiraiBot(){
  const bot = new Mirai({
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

  return bot;
}

function DealBangumiUpdate(reply, message, isActice){
  bangumi.updateBangumi(con).then(function(res){
    if(res.hasUpdate){
      let actions = [
        Plain(res.msg)
      ]
      res.users.forEach(qq => {
        actions.push(At(qq))
      });
      reply(actions, message);
    }else {
      if(isActice) reply([Plain("很遗憾，并没有番剧更新捏"), At(sender.id)], message);
    }
  })
}
