const axios = require('axios');
var convert = require('xml-js');

//自动更新资源并发送提醒
function updateBangumi(connection){
    return new Promise(function(resove, reject){
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
                let LastIndex = subscribes[index].lastIndex
                sub.source.forEach((item, index2) => {
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
                                return;
                            }
                            // console.log("新增成功", item.title);
                        });
    
                        //判断是否为新的一集，并更新番剧列表
                        if(item.episode > LastIndex){
                            LastIndex = item.episode
                            let sql = `UPDATE bangumi SET last_index = ? WHERE id = ?`;
                            let data = [item.episode, sub.id];
                            connection.query(sql, data, (error, results, fields) => {
                                if (error){
                                    return console.error(error.message);
                                }
                            });
                            //记录哪些番剧这次发生了更新
                            newList.push(item)
                            if(index == subscribes.length - 1){
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
                                        console.log("这些用户 ", results, "订阅了", item.title)
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
                    return item.replace("|", "")
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
                            results.push({
                                title: resource[0].title,
                                torrent: resource[0].torrent
                            })
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
                user = user[0]
                //subscribes长这样 |1||3| 先根据||分割字符串，得到 ['|1', '3|']，然后去除 | 字符，转为数字
                let subscribesArr = String(user.subscribes).split("||").map(function(item){
                    return item.replace("|", "")
                }).map(function(item){
                    return parseInt(item)
                })
                console.log("Arr: ", subscribesArr)
                //先查出来该用户订阅了哪些番剧
                let queryBangumiSql = `SELECT title from bangumi where id in (${subscribesArr})`    
                connection.query(queryBangumiSql, function (error, bangumis, fields) {
                    if (error) throw error;
                    console.log("bangumis: ", bangumis)
                    resove(bangumis)
                });
            });
        }).then(function(results) {
            let msg = "【订阅小助手】当前订阅番剧：\n"
            results.forEach((item, index) => {
                msg += `${index+1}. ${String(item.title).split(",")[0]}\n`
                // msg += index + item.title + "\n"
            });
            resoveOK(msg)
        })
    })

}


module.exports = {updateBangumi, getUpdateInfo, querySubscribeList}