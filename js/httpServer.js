const { rejects } = require('assert');
const http = require('http');
const url = require('url')

function InitHttpServer(conn){
    const server = http.createServer();
    server.on("request", function(req, res){
        console.log("request: ", req.url)

        const url = req.url.split("?")[0];
        if(url === '/bangumi/deal_subscribe'){
            DealSubscribe(req, res, conn)
        }else if(url === '/bangumi/query'){
            QueryList(req, res, conn)
        }
    
    })
    
    server.listen(3000, ()=>{
        console.log("接口服务已启动 port: 3000")
    })
}

function DealSubscribe(req, res, conn){
    const query = url.parse(req.url, true).query
    let bangumisString = query.bangumis.split(",").map(item => `|${item}|`).join("")
    let sql = "UPDATE `user` SET subscribes = ? WHERE qq = ?"
    let params=[bangumisString, query.qq];
    conn.query(sql,params,(err,result)=>{
        if (err) {
            res.writeHead(201, { 'Content-Type': 'text/plain' });
            res.end('更新失败');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    });
}

function QueryList(req, res, connection){
    const qq = url.parse(req.url, true).query.qq    
    new Promise((resolve, rejects) =>{
        //查询该用户订阅的番剧ID列表
        connection.query(`SELECT * from user where qq = ${qq}`, function (error, user, fields) {
            if (error)  rejects();
            user = user[0]
            let subscribesArr = String(user.subscribes).split("||").map(function(item){
                return item.replace("|", "")
            }).map(function(item){
                return parseInt(item)
            })
            console.log("Arr: ", subscribesArr)
            resolve(subscribesArr)
        })
    }).then(indexList => {        
        let list = []
        //查询所有番剧列表
        connection.query(`SELECT id, title from bangumi`, function (error, results, fields) {
            if (error)  rejects();
            results.forEach(bangumi => {
                list.push({
                    id: bangumi.id,
                    title: String(bangumi.title).split(",")[0],
                    flag: indexList.indexOf(bangumi.id) > -1 ? true: false
                })
            });

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(JSON.stringify(list));
        })
    })
}

module.exports = {InitHttpServer}