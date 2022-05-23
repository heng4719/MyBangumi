const axios = require('axios');
var convert = require('xml-js');
var mysql = require('mysql');
var qbot = require('./qbot')

function updateBangumi(){
    var connection = mysql.createConnection({
      host     : 'localhost',
      user     : 'root',
      password : '123456',
      database : 'bangumi'
    });     
    connection.connect();

    let subscribes = []
    //查询所有番剧
    connection.query('SELECT * from bangumi', function (error, results, fields) {
      if (error) throw error;
      console.log("results ", results)
      results.forEach(item => {
        let title = item.title.split(',')
        subscribes.push({
            id: item.id,
            title: title,
            lastIndex: item.last_index,
            source:[]
        })
      });
      console.log("subscribes ", subscribes)
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
        subscribes.forEach((sub, index) => {
            let LastIndex = subscribes[index].lastIndex
            sub.source.forEach(item => {
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
                        console.log("新增成功", item.title);
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
                            console.log('剧集数已更新:', item.episode);
                        });
                        //记录哪些番剧这次发生了更新
                        newList.push({
                            bangumiId: sub.id,
                            episode: item.episode
                        })
                    }
                  }
                });                
            });            
        });  

        //通知订阅用户
        qbot.noticeAll(newList, connection)
    })
    .catch(err => {
        console.log('Error: ', err.message);
    });    
}

module.exports = {updateBangumi}