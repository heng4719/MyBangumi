# 开发说明
## 一、基于Mirai框架实现的QQ机器人：
1. 以Mirai作为QQ机器人的运行环境，将机器人运行起来 (https://github.com/mamoe/mirai)
2. 使用Mirai-http-api作为机器人的接口插件，使我们可以与机器人进行交互，如获取和发送消息等 (https://github.com/project-mirai/mirai-api-http)
3. 使用node-mirai框架来进行开发，其实就是我们写JS代码调用node-mirai，node-mirai调用mirai-http-api，mirai-http-api调用mirai-core以实现功能。(https://github.com/RedBeanN/node-mirai)

## 二、目录说明
1. /main.js：入口函数
2. /js/xxx.js: 功能模块
3. /mirai: Mirai机器人运行环境

## 三、环境搭建
### 3.1 Mirai机器人登录

1. 先把Mirai机器人跑起来，在mirai文件夹下面运行mcl-installer-1.0.7-windows-amd64.exe文件，跟随提示进行安装.
2. 安装完成后，mirai文件夹里面应该会增加很多文件，运行其中的 mcl.cmd 启动服务,成功后会看到绿色的 mirai-console started successfully。
3. 可以暂时先把窗口关闭，因为要安装两个关键插件，mirai-api-http和chat-command，很简单，在mcl所在根目录下运行如下两个命令即可：
   
   ```
   mcl --update-package net.mamoe:mirai-api-http --type plugin --channel stable-v2
   mcl --update-package net.mamoe:chat-command --type plugin --channel stable
   ```
4. 如果想再加上那个涩图机器人，可以把mirai/plugins_bak下面的pixiv-xxx.jar文件放到mirai/plugins文件夹里面即可
5. 然后去注册个QQ号用来作为机器人账号，顺便一提我注册的机器人的QQ号：xxxx18181，最后是18181，感觉挺好的。
6. 然后再次打开mcl.cmd，你注意看日志，里面会有加载插件的日志出现。
7. 然后登录机器人QQ，你也可以输入help来查看指令列表，注意 <qq>表示必填 [password]表示选填
   1. /autoLogin add <qq> <密码> #这一步是用来给Mirai添加自动登录配置的，以后就不用每次输入了
   2. /login <qq> [密码] #这一步才是登录
8. 第一次登录需要验证，他会在命令行里面给你一大长串地址，你复制之后在浏览器里面打开，是一个滑动验证页面，先别急着滑动，先F12打开调试框，点击network打开网络请求页面
9. 完成滑动验证，这时你会发现network里面发送了一条请求，然后点开他，看他的返回里面有个tick_token好像叫这个名字的字段，复制这个字段的值然后粘贴回mcl.bat的命令行窗口里面，回车确认就可以完成登录了，登录成功时，会显示 Bot login successful.的日志输出。
#
### 3.2 配置插件
1. 先把当前运行的机器人命令行窗口关了，不然配置会被重置！
2. 插件文件被放在了/mirai/plugins下面，你可以看下，应该可以看到我们之前安装的那两个http-api和chat-command的jar包文件
3. 插件需要进行配置，插件的配置文件被放在了 /mirai/config 下面，点进去，我们配置http
4. 目录地址：mirai/config/net.mamoe.mirai-api-http/Setting.yml:
```
adapters: 
  - http
  - ws
debug: false
enableVerify: true
verifyKey: INITKEYEC6eueUp
singleMode: true
cacheSize: 4096
adapterSettings: 
  http:
    host: 127.0.0.1
    port: 8082
    cors: [*]  
  ws:
    host: 127.0.0.1
    port: 8082
    reservedSyncId: -1
```
4. 然后重新启动mcl.cmd，不报错就是胜利

### 3.3 运行本地开发环境
1. 在项目根目录下面运行 npm install 安装依赖
2. 然后vscode打开项目，点开main.js，点击运行->启动调试
3. 如果底部控制台里面出现如下字样即表示启动成功，接下来可以欣赏我的代码并进行开发工作了。
```
接口服务已启动 port: 3000
js/httpServer.js:20
Authed with session key undefined
main.js:129
Verified with session key undefined
main.js:135
There are 4 friends in bot
```