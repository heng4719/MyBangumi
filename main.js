var bangumi = require('./js/updateBangumi')
var httpServer = require('./js/httpServer')
var mark = require('./js/mark')
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

process.on('uncaughtException', (e) => {
  console.log('有人点了份炒饭！');
  // bot.sendGroupMessage("说了我们店里不卖炒饭！", 828937993)
  console.log(e);
});
//注册事件
bot.onMessage(async message => {
  console.log("message: ", message)
  const { type, sender, messageChain, reply, quoteReply } = message;
  let msg = '';
  let img = ''
  messageChain.forEach(chain => {
    if (chain.type === 'Plain')
        msg += Plain.value(chain);       // 从 messageChain 中提取文字内容
    if (chain.type === 'Image')
        img = chain.url;       // 从 messageChain 中提取文字内容
  });
  // console.log("msg: ", msg)
  // console.log("img: ", img)
  // console.log("sender: ", sender)

  
    //测试主动群聊
    if(msg.includes("t1")){
      console.log("sender.group.id ", sender.group.id)
      bot.sendGroupMessage("Hello", sender.group.id)
    }

  if(String(msg).split(" ")[0] == "bgm"){
    //------------------------------------------
    //-----------------番剧订阅 Start------------
    // bgm <command> [params]
    // bgm list :  查询可订阅番剧列表
    // bgm mylist: 我的订阅列表
    // bgm add|del <番剧ID,番剧ID>: 增删我的订阅
    // bgm new: 我当前订阅番剧的最新资源
    // bgm manage add|del <番剧名称> 

    // 主动更新番剧资源: bgm update
    // 订阅通知开关选项: bgm notice on/off
    // 查询最新订阅更新: bgm new
    // 进入订阅管理网页: bgm manageWeb
    // 查询自己订阅列表: bgm mylist
    // 进行番剧列表管理: bgm manage <queryAll|add|del> [poarams]
    // 新增删除订约番剧: bgm add|del 番剧id
    //------------------------------------------

    //主动查询番剧更新情况
    if (msg.includes('bgm help') || msg.includes('bgm -h')){    
      let msg = `指令格式:bgm <command> [params]
      查询当前可订阅番剧:bgm list
      查询自己的订阅列表:bgm mylist
      查询自己最新订阅:bgm new
      新增我的订阅:bgm add 番剧ID,番剧ID
      删除我的订阅:bgm del 番剧ID,番剧ID
      新增番剧列表:bgm manage add 番剧名称,番剧别名
      删除番剧列表:bgm manage del 番剧ID,番剧ID`
      bot.quoteReply([Plain(msg)], message); 
    }
        
    //主动查询番剧更新情况
    if (msg.includes('bgm update')){    
      console.log("开始查询番剧更新情况")
      // DealBangumiUpdate(true, sender.group.id, bot);
      
      bangumi.autoUpdate(con).then(function(res){
        console.log("res1 ", res)
        if(res.hasUpdate){
          let actions = [
            Plain(res.msg)
          ]
          res.users.forEach(qq => {
            actions.push(At(qq))
          });
          bot.sendGroupMessage(actions, sender.group.id)
        }
      })
    }

    //开启订阅通知
    if (msg.includes('bgm notice')){
      if(msg.includes('bgm notice on')){
        //检查是否已开启
        if(NoticeGroup.filter(function(item){
          return item.groupId == sender.group.id
        }).length == 0) {
          let interval = setInterval( function(){
            bangumi.autoUpdate(con).then(function(res){
              if(res.hasUpdate){
                let actions = [
                  Plain(res.msg)
                ]
                res.users.forEach(qq => {
                  actions.push(At(qq))
                });
                bot.sendGroupMessage(actions, sender.group.id)
              }
            })
          
          }, 1000 * 60 * 1); //每1分钟拉取一次        
          NoticeGroup.push({
            groupId: sender.group.id,
            interval: interval
          })
          if(interval) bot.quoteReply([Plain('订阅通知已开启')], message); 
        }else{
          bot.quoteReply([Plain('本群已开启订阅通知，憋重复发命令')], message); 
        }
      }else if(msg.includes('bgm notice off')){
        let arr = NoticeGroup.filter(function(item){
          return item.groupId == sender.group.id
        })
        if(arr.length == 0){
          bot.quoteReply([Plain('本群并未开启订阅通知')], message); 
        }else{
          clearInterval(arr[0].interval)
          bot.quoteReply([Plain('订阅通知已关闭')], message); 
        }
      }
    }

    //查询该用户订阅的所有新番的最新一集
    if(msg.includes('bgm new')){
      bangumi.getUpdateInfo(con, sender.id).then(function(result){
        bot.quoteReply([Plain(result)], message);
      });    
    }

    if(msg.includes('bgm manageWeb')){
      let returnMsg = `目前仅提供网页端订阅管理功能，你的管理页面:http://budeliao.top/bangumi/subscribe?qq=${sender.id}`
      reply(returnMsg);
    }

    //订阅列表
    if(msg.includes('bgm mylist')){
      bangumi.querySubscribeList(con, sender.id).then(msg => {
        bot.quoteReply([Plain(msg)], message);
      })
    }

    if(msg.includes('bgm manage')){
      bangumi.bungumiManage(msg, sender, con).then( msg => {
        bot.quoteReply([Plain(msg)], message);
      })  
    }

    if(msg.includes('bgm list')){
      bangumi.bungumiManage("bgm manage queryAll", sender, con).then( msg => {
        bot.quoteReply([Plain(msg)], message);
      })  
    }

    if(msg.includes('bgm add') || msg.includes('bgm del')){
      bangumi.DealSubscribe(msg, sender, con).then( msg => {
        bot.quoteReply([Plain(msg)], message);
      })
    }
  }

  //添加新mark
  if(msg.includes('#mark ')){
    mark.insert(con, sender.id, msg, img).then(function(result){
      bot.quoteReply([Plain(result)], message);
    });    
  }
  //------------------------------------------
  //-----------------番剧订阅 End--------------
  //------------------------------------------

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

function DealBangumiUpdate(isActice, groupId, bot){
  console.log("DealBangumiUpdate")
  bangumi.updateBangumi(con).then(function(res){
    if(res.hasUpdate){
      let actions = [
        Plain(res.msg)
      ]
      res.users.forEach(qq => {
        actions.push(At(qq))
      });
      console.log("发生更新，进行通知 actions", actions)
      console.log("发生更新，进行通知 groupId", groupId)
      bot.sendGroupMessage(actions, groupId).then(res => {
        console.log("res ", res)
      })
    }else {
      console.log("未发生更新，如果主动则进行通知")
      if(isActice) 
        bot.sendGroupMessage("很遗憾，并没有番剧更新捏", groupId);
      // reply([Plain("很遗憾，并没有番剧更新捏"), At(sender.id)], message);
    }
  })
}
