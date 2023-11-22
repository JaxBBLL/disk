const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const util = require("util");
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

const config = (function () {
  const defaultConfig = {
    dest: "./",
    hasDel: true,
    port: 3000,
  };
  try {
    const config = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "./config.json"), "utf-8")
    );
    return Object.assign(defaultConfig, config);
  } catch {
    return defaultConfig;
  }
})();
const { hasDel, port } = config;
const dest = path.resolve(__dirname, config.dest);
const app = express();
// 解析post的两个中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const filePath = (req.query.filePath || "").split(",");
    if (!fs.existsSync(dest)) {
      fs.mkdir(dest, { recursive: true }, (err) => {
        if (err) throw err;
        cb(null, path.join(dest, ...filePath));
      });
    } else {
      cb(null, path.join(dest, ...filePath));
    }
  },
  filename: function (req, file, cb) {
    // 获取上传文件的原始文件名，并处理中文乱码
    const originalname = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
    const ext = path.extname(originalname);
    const baseName = path.basename(originalname, ext);

    const generateFileName = (base, ext, index) => {
      if (index === 0) {
        return `${base}${ext}`;
      } else {
        return `${base}-${index}${ext}`;
      }
    };

    let index = 0;
    let newFileName = generateFileName(baseName, ext, index);

    while (fs.existsSync(path.join(dest, newFileName))) {
      index++;
      newFileName = generateFileName(baseName, ext, index);
    }
    console.log("文件上传成功：", newFileName);
    cb(null, newFileName);
  },
});

const upload = multer({
  encoding: "utf-8",
  storage: storage,
});

// 处理静态文件请求
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 处理多文件上传的路由
app.post("/uploads", upload.array("files"), (req, res) => {
  if (req.files && req.files.length) {
    res.send({
      code: 200,
      message: "文件上传成功",
    });
  } else {
    res.status(500).send({ message: "文件上传失败" });
  }
});

app.post("/list", async (req, res) => {
  const paths = req.body.filePath || [];
  try {
    const files = await readdir(path.join(dest, ...paths));
    if (!files.length) {
      return res.send({ code: 200, data: [] });
    }
    const ret = [];
    for (let file of files) {
      const filePath = path.join(dest, ...paths, file);
      const stats = await stat(filePath).catch((err) => {
        return null;
      });
      if (!stats) {
        continue;
      }
      // if (!stats.isDirectory()) {
      ret.push({
        name: file,
        isDirectory: stats.isDirectory(),
        filePath: path.join(...paths, file),
        size: (stats.size / 1024).toFixed(2),
        birthtime: formatDate(stats.birthtime, "YYYY-MM-DD HH:mm"),
        updatetime: formatDate(stats.mtime, "YYYY-MM-DD HH:mm"),
        hasDel,
      });
      // }
    }
    return res.send({ code: 200, data: ret });
  } catch (err) {
    console.error(err);
    return res.status(500).send({ message: "读取目录失败" });
  }
});
app.get("/download", (req, res) => {
  const filePath = req.query.filePath;
  const fileName = path.basename(filePath);
  const realFilePath = path.join(dest, filePath);

  // 设置响应头，指定文件类型和名称
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${encodeURIComponent(fileName)}` // 对文件名进行URL编码
  );

  // 将文件流式传输到响应中
  const stream = fs.createReadStream(realFilePath);
  stream.pipe(res);
});

app.get("/delete", (req, res) => {
  const filePath = req.query.filePath;
  const realFilePath = path.join(dest, filePath);

  deleteFileOrFolder(realFilePath)
    .then((message) => {
      res.send({
        code: 200,
        message: "删除成功",
      });
      console.log("文件删除成功：", filePath);
    })
    .catch((err) => console.error("删除文件时发生错误:", err));
});

function getLocalIP() {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];

  for (const interfaceName in networkInterfaces) {
    const networkInterface = networkInterfaces[interfaceName];

    for (let i = 0; i < networkInterface.length; i++) {
      const networkAddress = networkInterface[i];

      if (networkAddress.family === "IPv4" && !networkAddress.internal) {
        addresses.push(networkAddress.address);
      }
    }
  }
  return addresses;
}

async function deleteFileOrFolder(path) {
  try {
    // 判断路径是否为文件
    const stat = fs.statSync(path);
    if (stat.isFile()) {
      // 删除文件
      fs.unlinkSync(path);
      console.log(`File ${path} deleted successfully.`);
    } else if (stat.isDirectory()) {
      // 递归删除文件夹及其内容
      fs.rmSync(path, { recursive: true, force: true });
      console.log(`Folder ${path} deleted successfully.`);
    } else {
      console.log(`${path} is not a file or folder.`);
    }
  } catch (error) {
    console.error(`An error occurred while deleting ${path}: ${error.message}`);
  }
}

function formatDate(date, fmt = "YYYY-MM-DD HH:mm:ss") {
  if (!date) {
    return "";
  }
  if (typeof date === "string") {
    date = new Date(date.replace(/-/g, "/"));
  }
  if (typeof date === "number") {
    date = new Date(date);
  }
  var o = {
    "M+": date.getMonth() + 1,
    "D+": date.getDate(),
    "h+": date.getHours() % 12 === 0 ? 12 : date.getHours() % 12,
    "H+": date.getHours(),
    "m+": date.getMinutes(),
    "s+": date.getSeconds(),
    "q+": Math.floor((date.getMonth() + 3) / 3),
    S: date.getMilliseconds(),
  };
  var week = [
    "\u65e5",
    "\u4e00",
    "\u4e8c",
    "\u4e09",
    "\u56db",
    "\u4e94",
    "\u516d",
  ];
  if (/(Y+)/.test(fmt)) {
    fmt = fmt.replace(
      RegExp.$1,
      (date.getFullYear() + "").substr(4 - RegExp.$1.length)
    );
  }
  if (/(E+)/.test(fmt)) {
    fmt = fmt.replace(
      RegExp.$1,
      (RegExp.$1.length > 1
        ? RegExp.$1.length > 2
          ? "\u661f\u671f"
          : "\u5468"
        : "") + week[date.getDay()]
    );
  }
  for (var k in o) {
    if (new RegExp("(" + k + ")").test(fmt)) {
      fmt = fmt.replace(
        RegExp.$1,
        RegExp.$1.length === 1 ? o[k] : ("00" + o[k]).substr(("" + o[k]).length)
      );
    }
  }
  return fmt;
}

app.listen(port, () => {
  const ip = getLocalIP().find((i) => i.startsWith("192"));
  console.log(`http://${ip || "localhost"}:${port}`);
});
