FROM node:16-alpine
  
# 设置工作目录为/app
WORKDIR /app

# 创建空目录
RUN mkdir disk

# 将当前目录内容复制到容器的/app内  
COPY . /app
  
# 安装项目依赖  
RUN npm install --production
  
# 对外暴露的端口号  
EXPOSE 3000
  
# 当容器启动时运行npm start  
CMD [ "npm", "start" ]
