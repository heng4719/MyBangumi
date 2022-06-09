const axios = require('axios');
var convert = require('xml-js');
const url = require('url');
const { resolve } = require('path');

function autoUpdate(connection){
    return new Promise( (resolve, reject) => {
        let subscribes = []
        //查询该用户订阅的所有番剧
        new Promise((r, j) => {
            connection.query('SELECT * from bangumi', function (error, results, fields) {
              if (error) {
                  j("ERR 1")
                  throw error;
              }
              results.forEach(item => {
                let title = item.title.split(',')
                subscribes.push({
                    id: item.id,
                    title: title,
                    lastIndex: item.last_index,
                    source:[]
                })
              });
              r(subscribes)
            })
        }).then(subscribes => {
            return new Promise((r,j)=>{
                axios.get('https://mikanani.me/RSS/MyBangumi?token=g7fiCQpq5lEeUkZ3gSn27LgehEcZ3larcTuNwFb5LUw%3d')
                .then(res => {
                    var result = convert.xml2json(res.data, {compact: true, spaces: 4});
                    let rss = JSON.parse(result)
                    let bangumi = rss.rss.channel.item;        
                    //填充订阅资源列表
                    subscribes.forEach((sub, index) => {
                        //可能存在多个名称，所以每个名称都匹配一遍
                        sub.title.forEach(name => {
                            bangumi.forEach(anim => {
                                if(anim.guid._text.lastIndexOf(name) >= 0){
                                    //查询出这是第几集
                                    let episodeIndex = String(anim.guid._text).search(/\[[0-9][0-9]\]/) == -1 ? //[05]
                                            (String(anim.guid._text).search(/\【[0-9][0-9]\】/) == -1 ? //【05】
                                                (String(anim.guid._text).search(/\s[0-9][0-9]\s/) == -1 ? //  05  
                                                -1:String(anim.guid._text).search(/\s[0-9][0-9]\s/))
                                            :String(anim.guid._text).search(/\【[0-9][0-9]\】/) )
                                        :String(anim.guid._text).search(/\[[0-9][0-9]\]/)
                                    if(episodeIndex != -1){
                                        let episode = parseInt(anim.guid._text.slice(episodeIndex+1, episodeIndex+3))
                                        subscribes[index].source.push({
                                            bangumiId: sub.id,
                                            title: anim.guid._text,
                                            episode: episode,
                                            link: anim.link._text,
                                            torrent: anim.enclosure._attributes.url
                                        })
                                        
                                    }
                                }
                            });
                        })
                    })            
                    //按集数倒序排列
                    subscribes.forEach(sub => {
                        sub.source.sort(function(a, b) {
                            return b.episode - a.episode
                        })
                    });
                    r(subscribes);
                })
            }).then(subscribes => {
                return new Promise((r,j)=>{
                    //更新番剧资源
                    let newList = []
                    // console.log("subscribes: ", subscribes)
                    subscribes.forEach((sub, index) => {
                        // console.log("out loop ", index)
                        let LastIndex = subscribes[index].lastIndex
                        sub.source.forEach((item, index2) => {
                            // console.log(index , subscribes.length - 1, index2, sub.source.length -1)
                            //判断该资源是否已被收录
                            let sql = `SELECT id from resources where link = '${item.link}'`
                            connection.query(sql, function (error, results, fields) {
                              if (error) throw error;
                              if(results.length == 0){
                                //说明该资源为新增，需要插入数据库
                                let sql = "insert into resources values(?,?,?,?,?,?)";
                                let params=[null,sub.id, item.title, item.episode, item.link, item.torrent];
                                connection.query(sql,params,(err,result)=>{
                                    if (err) {
                                        console.error("新增失败" + err.message);
                                    }
                                    console.log("新增成功", item.title);
                                });
                            
                                //判断是否为新的一集，并更新番剧列表
                                if(item.episode > LastIndex){
                                    //记录哪些番剧这次发生了更新
                                    newList.push(item)
                                    console.log("发现了更新资源", item.title)
                                    LastIndex = item.episode
                                    let sql = `UPDATE bangumi SET last_index = ? WHERE id = ?`;
                                    let data = [item.episode, sub.id];
                                    connection.query(sql, data, (error, results, fields) => {
                                        if (error){
                                            console.error(error.message);
                                            j();
                                        }
                                    });
                                }
                              }
                              if(index == subscribes.length - 1 && index2 ==  sub.source.length -1){
                                  let msg = "【订阅小助手】有番剧更新啦\n"
                                  if(newList.length == 0){
                                      r({
                                          msg: msg,
                                          hasUpdate: false
                                      })  
                                  }
                                  let users = new Set();
                                  newList.forEach((item, index) => {                                  
                                      //查出有哪些用户订阅了该番剧 
                                      let sql = `select qq from user where subscribes like '%|${item.bangumiId}|%'`
                                      connection.query(sql, null, (error, results, fields) => {
                                          if (error){
                                              j(); console.error(error.message);
                                          }
                                          if(results.length != 0){
                                            msg += "-------------------\n"
                                            msg += "番剧名称: " + item.title + "\n"
                                            msg += "种子地址: " + item.torrent + "\n"
                                            results.forEach(user => {
                                                users.add(parseInt(user.qq))
                                            });
                                          }
                                          if(index == newList.length-1){
                                              users = Array.from(users)
                                              if(users.length > 0){
                                                msg += "-------------------\n"
                                                r({
                                                    msg: msg,
                                                    users: Array.from(users),
                                                    hasUpdate: true
                                                })  

                                              }
                                          }
                                      });
                                  });
                              }
                            });  
                        });              
                    }); 
                    // console.log("跑完了 newlist: ", newList)
                }).then(res => {
                    resolve(res)
                })
            })
        })
    })
}

//自动更新资源并发送提醒
function updateBangumi(connection){
    return new Promise(function(resove, reject){
        console.log("updateBangumi 1")
        let subscribes = []
        //查询该用户订阅的所有番剧
        connection.query('SELECT * from bangumi', function (error, results, fields) {
          if (error) throw error;
          results.forEach(item => {
            let title = item.title.split(',')
            subscribes.push({
                id: item.id,
                title: title,
                lastIndex: item.last_index,
                source:[]
            })
          });
        });
    
        axios.get('https://mikanani.me/RSS/MyBangumi?token=g7fiCQpq5lEeUkZ3gSn27LgehEcZ3larcTuNwFb5LUw%3d')
        .then(res => {
            var result = convert.xml2json(res.data, {compact: true, spaces: 4});
            let rss = JSON.parse(result)
            let bangumi = rss.rss.channel.item;        
            //填充订阅资源列表
            subscribes.forEach((sub, index) => {
                //可能存在多个名称，所以每个名称都匹配一遍
                sub.title.forEach(name => {
                    bangumi.forEach(anim => {
                        if(anim.guid._text.lastIndexOf(name) >= 0){
                            //查询出这是第几集
                            let episodeIndex = String(anim.guid._text).search(/\[[0-9][0-9]\]/) == -1 ? //[05]
                                    (String(anim.guid._text).search(/\【[0-9][0-9]\】/) == -1 ? //【05】
                                        (String(anim.guid._text).search(/\s[0-9][0-9]\s/) == -1 ? //  05  
                                        -1:String(anim.guid._text).search(/\s[0-9][0-9]\s/))
                                    :String(anim.guid._text).search(/\【[0-9][0-9]\】/) )
                                :String(anim.guid._text).search(/\[[0-9][0-9]\]/)
                            if(episodeIndex != -1){
                                let episode = parseInt(anim.guid._text.slice(episodeIndex+1, episodeIndex+3))
                                subscribes[index].source.push({
                                    bangumiId: sub.id,
                                    title: anim.guid._text,
                                    episode: episode,
                                    link: anim.link._text,
                                    torrent: anim.enclosure._attributes.url
                                })
                                
                            }
                        }
                    });
                })
            })
    
            //按集数倒序排列
            subscribes.forEach(sub => {
                sub.source.sort(function(a, b) {
                    return b.episode - a.episode
                })
            });


            //更新番剧资源
            let newList = []
            console.log("subscribes: ", subscribes)
            subscribes.forEach((sub, index) => {
                // console.log("out loop ", index)
                let LastIndex = subscribes[index].lastIndex
                sub.source.forEach((item, index2) => {
                    // console.log("inner loop ", index)
                    //判断该资源是否已被收录
                    let sql = `SELECT id from resources where link = '${item.link}'`
                    connection.query(sql, function (error, results, fields) {
                      if (error) throw error;
                      if(results.length == 0){
                        //说明该资源为新增，需要插入数据库
                        let sql = "insert into resources values(?,?,?,?,?,?)";
                        let params=[null,sub.id, item.title, item.episode, item.link, item.torrent];
                        connection.query(sql,params,(err,result)=>{
                            if (err) {
                                console.error("新增失败" + err.message);
                                resove();
                            }
                            // console.log("新增成功", item.title);
                        });
    
                        //判断是否为新的一集，并更新番剧列表
                        if(item.episode > LastIndex){
                            //记录哪些番剧这次发生了更新
                            newList.push(item)
                            console.log("发现了更新资源", item)
                            LastIndex = item.episode
                            let sql = `UPDATE bangumi SET last_index = ? WHERE id = ?`;
                            let data = [item.episode, sub.id];
                            connection.query(sql, data, (error, results, fields) => {
                                if (error){
                                    console.error(error.message);
                                    resove();
                                }
                            });
                        }
                        
                        // console.log("inner loop2 ", index)
                        // console.log(index , subscribes.length - 1, index2, sub.source.length -1)
                        if((index == subscribes.length - 1) && (index2 == sub.source.length -1)){
                            console.log("newList ", newList)           
                            //     //组织文本
                            let msg = "【订阅小助手】有番剧更新啦\n"
                            if(newList.length == 0){
                                resove({
                                    msg: msg,
                                    hasUpdate: false
                                })  
                            }
                            let users = new Set();
                            newList.forEach((item, index) => {
                                msg += "-------------------\n"
                                msg += "番剧名称: " + item.title + "\n"
                                msg += "种子地址: " + item.torrent + "\n"

                                //查出有哪些用户订阅了该番剧 
                                let sql = `select qq from user where subscribes like '%|${item.bangumiId}|%'`                              
                                connection.query(sql, data, (error, results, fields) => {
                                    if (error){
                                        return console.error(error.message);
                                    }
                                    results.forEach(user => {
                                        users.add(parseInt(user.qq))
                                    });

                                    if(index == newList.length-1){
                                        msg += "-------------------\n"
                                        resove({
                                            msg: msg,
                                            users: Array.from(users),
                                            hasUpdate: true
                                        })  
                                    }
                                });
                            });             
                        }
                      }
                    });  
                });              
            }); 
            
            
        })
        .catch(err => {
            console.log('Error: ', err.message);
        });
    })
}

/*查询该用户订阅番剧的最新情况
【订阅小助手】最新番剧资源
------------------------------
番剧名称:古见同学有交流障碍症[19]
下载地址:https://mikanani.me/Download/20220519/20e2db4e41a3a4c5f110428a8c06cfd433d676f9.torrent
@张大力
------------------------------
*/
function getUpdateInfo(connection, qq){
    return new Promise(function(resoveOK, reject){    
        let results = []    
        new Promise(function(resove, reject){
            connection.query(`SELECT * from user where qq = ${qq}`, function (error, user, fields) {
                if (error) throw error;
                user = user[0]
                // console.log("user ", user)
                // console.log("subscribes ", user.subscribes)
                //subscribes长这样 |1||3| 先根据||分割字符串，得到 ['|1', '3|']，然后去除 | 字符，转为数字
                let subscribesArr = String(user.subscribes).split("||").map(function(item){
                    return item.replaceAll("|", "")
                }).map(function(item){
                    return parseInt(item)
                })
                console.log("Arr: ", subscribesArr)
                //先查出来该用户订阅了哪些番剧
                let queryBangumiSql = `SELECT * from bangumi where id in (${subscribesArr})`
                console.log("queryBangumiSql ", queryBangumiSql)        
                connection.query(queryBangumiSql, function (error, bangumis, fields) {
                    if (error) throw error;
                    // console.log("bangumis ", bangumis)
                    bangumis.forEach((bangumi, index) => {
                        let queryResourceSql = `select * from resources where bangumiId = ${bangumi.id} and episode = ${bangumi.last_index}`
                        // console.log("queryResourceSql ", queryResourceSql)        
                        connection.query(queryResourceSql, function (error, resource, fields) {
                            if (error) throw error;
                            if(resource.length > 0){
                                results.push({
                                    title: resource[0].title,
                                    torrent: resource[0].torrent
                                })
                            }
                            if(index == bangumis.length - 1){
                                resove(results)
                            }
                        });                
                    });
                });
            });
        }).then(function(results) {        
            // console.log("results ", results)
            //组装文本
            let msg = "【订阅小助手】订阅中的最新番剧\n"
            results.forEach(item => {
                msg += "-------------------\n"
                msg += "番剧名称: " + item.title + "\n"
                msg += "种子地址: " + item.torrent + "\n"
                // msg += "-------------------\n"
            });
            resoveOK(msg)
            // console.log("results:", msg)

        })
    })
}

function querySubscribeList(connection, qq){
    return new Promise(function(resoveOK, reject){
        new Promise(function(resove, reject){
            connection.query(`SELECT * from user where qq = ${qq}`, function (error, user, fields) {
                if (error) throw error;
                if(user.length == 0) {
                    let sql = `insert into user(qq, subscribes) values(?,'')`;
                    let params = [qq]
                    connection.query(sql,params,(err,user)=>{
                        if (err) {
                            console.error("新增失败" + err.message);
                            resove("奇怪，你的初始化失败了");
                        }else{
                            resove("还没有订阅任何番剧捏");
                        }
                    });
                }else{
                    user = user[0]
                    if(user.subscribes.length == 0){
                        resove("还没有订阅任何番剧捏");                        
                    }else{
                        //subscribes长这样 |1||3| 先根据||分割字符串，得到 ['|1', '3|']，然后去除 | 字符，转为数字
                        let subscribesArr = String(user.subscribes).split("||").map(function(item){
                            return item.replaceAll("|", "")
                        }).map(function(item){
                            return parseInt(item)
                        })
                        console.log("Arr: ", subscribesArr)
                        //先查出来该用户订阅了哪些番剧
                        let queryBangumiSql = `SELECT id, title from bangumi where id in (${subscribesArr})`    
                        connection.query(queryBangumiSql, function (error, bangumis, fields) {
                            if (error) throw error;
                            console.log("bangumis: ", bangumis)
                            resove(bangumis)
                        });
                    }                    
                }
            });
        }).then(function(results) {
            if(typeof(results) == 'string'){
                resoveOK(results)
            }else{
                let msg = "【订阅小助手】当前订阅番剧：\n"
                results.forEach((item, index) => {
                    msg += `${item.id}. ${String(item.title).split(",")[0]}\n`
                });
                resoveOK(msg)
            }
        })
    })
}
//bgm manage <method> [params]
//bgm manage add 番剧1,1别名|番剧2|番剧三
//bgm manage del 1|2|3
//bgm manage queryAll
function bungumiManage(msg, sender, connection){
    return new Promise((resove, reject) => {
        let req = String(msg).split(' ')
        let method = req[2]
        switch(method){
            case "queryAll":{
                //返回所有番剧
                connection.query(`SELECT * from bangumi`, function (error, results, fields) {
                    if (error) throw error;                
                    let msg = "【订阅小助手】番剧列表：\n"
                    results.forEach((item) => {
                        msg += `${item.id}. ${item.title}\n`
                    });
                    resove(msg)
                });            
                break;
            }
            case "add":{
                // if(sender.id != '986472954') return "只有管理员才可以操作番剧，注意你的身份！"
                if(req.length < 4) resove("缺少参数")
                let nameArr = String(req[3]).split("|")
                nameArr.forEach((name, index) => {                    
                    let sql = "insert into bangumi(title, last_index) values(?,0)";
                    let params=[name];
                    connection.query(sql,params,(err,result)=>{
                        if (err) {
                            console.error("新增失败" + err.message);
                        }
                    });
                    if(index == nameArr.length - 1){
                        resove("操作完成")
                    }
                });
                break;
            }
            case "del":{
                // if(sender.id != '986472954') return "只有管理员才可以操作番剧，注意你的身份！"
                if(req.length < 4) resove("缺少参数")
                let ids = String(req[3]).split("|")
                let sql = `delete from bangumi where id in (${ids.toString()})`;
                connection.query(sql,null,(err,result)=>{
                    if (err) {
                        console.error("新增失败" + err.message);
                    }
                    resove("操作完成")
                });
                break
            }
        }

    })
}

//bgm add|del 1,2,4
function DealSubscribe(msg, sender, connection){
    return new Promise( (resove, reject) => {
        let msgArr = msg.split(" ")
        //参数校验
        let check = checkParams("DealSubscribe", msg)
        console.log("check: ", check)
        if(!check.pass){
            resove(check.msg)
            return
        }
        //判断该用户是否存在于user
        new Promise((r,j) => {
            let sql = `select * from user where qq = ${sender.id}`;
            connection.query(sql,null,(err,users)=>{
                if (err) {
                    console.error("新增失败" + err.message);
                }
                if(users.length == 0){
                    //说明此前没有该用户，需要新增一下用户，如果碰巧也是add指令，就一起做了，del指令就忽略不管
                    let subs = ""
                    if(msgArr[1] == "add"){
                        subs = msgArr[2].split(",").map(item => `|${item}|`).join("")
                    }else{
                        r("并没有可供删除的订阅")
                    }
                    let sql = `insert into user(qq, subscribes) values(?,?)`;
                    let params = [sender.id, subs]
                    connection.query(sql,params,(err,user)=>{
                        if (err) {
                            console.error("新增失败" + err.message);
                        }else{
                            r("添加完成");
                        }
                    });
                }else{
                    //查询到了该用户
                    let user = users[0]
                    let hasSet;
                    if(user.subscribes.length == 0){
                        //空
                        hasSet = new Set();
                    }else if(user.subscribes.length > 0 && user.subscribes.indexOf("||") < 0){
                        //只有一条
                        hasSet = new Set([String(user.subscribes).replaceAll("|", "")])
                    }else {
                        hasSet = new Set(String(user.subscribes).split("||").map(item => item.replaceAll("|", "")))
                    }
                    // hasSet = new Set(String(user.subscribes).split("||").map(item => item.replace("|", "")))
                    let reqArr = String(msgArr[2]).split(",")
                    reqArr.forEach(id => {
                        msgArr[1] == "add" ? hasSet.add(id): hasSet.delete(id)
                    });
                    hasSet = [...hasSet]
                    let subscribes = hasSet.map(id => `|${id}|`).join("")
                    console.log("subscribes", subscribes)                    
                    let sql = `update user set subscribes = '${subscribes}' where id = ${user.id}`;
                    console.log("sql", sql)            
                    connection.query(sql,null,(err,user)=>{
                        if (err) {
                            console.error("新增失败" + err.message);
                        }else{
                            msgArr[1] == "add" ? r("添加完成"): r("删除完成")
                        }
                    });
                }
            });
        }).then(res => {
            resove(res)
        })
    })
}

function checkParams(funcName, msg){
    switch(funcName){
        //bgm add|del 1,2,4
        case "DealSubscribe": {
            let commands = String(msg).split(" ")
            //长度校验
            if(commands.length != 3){
                return {
                    pass: false,
                    msg: "不好意思我们店里不卖炒饭"
                }
            }
            let paramString = commands[2]
            let params = paramString.split(",")
            let flag = false
            params.forEach(element => {
                console.log("isNumber(Number(element)): ", isNumber(Number(element)))
                if(!isNumber(Number(element)) || element.indexOf("e") >= 0){
                    flag = true
                }
            });
            if(flag){
                return {
                    pass: false,
                    msg: "不好意思我们店里不卖炒饭"
                }
            }else{
                return {
                    pass: true,
                    msg: ""
                }
            }
            
        }
    }
}
function isNumber(num) {
	return typeof num === 'number' && !isNaN(num)
}
module.exports = {updateBangumi, getUpdateInfo, querySubscribeList, bungumiManage, DealSubscribe, autoUpdate}