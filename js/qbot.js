/*
【订阅小助手】有新的番剧更新
------------------------------
番剧名称:古见同学有交流障碍症[19]
下载地址:https://mikanani.me/Download/20220519/20e2db4e41a3a4c5f110428a8c06cfd433d676f9.torrent
@张大力@XXX
------------------------------
*/
function noticeAll(list, connection){
    console.log("list", list)
    let noticeArry = new Map()
    list.forEach(item => {
        
    });
    //查询所有用户，并匹配其本次是否有需要通知更新的番剧
    connection.query('SELECT * from user', function (error, results, fields) {
        if (error) throw error;
        console.log("results ", results)
        results.forEach(user => {
            let subscribeList = user.notice.split(',')            
            list.forEach(item => {
                if(subscribeList.indexOf(item.bangumiId) > 0){
                    noticeArry.push({
                        qq: user.qq,
                        bangumiId:bangumiId
                    })
                }
            });
        });
      });
}

module.exports = {noticeAll}