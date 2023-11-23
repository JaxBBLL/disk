async function processFiles(fileList, files) {
  for (const file of fileList) {
    if (file.isDirectory) {
      const directoryReader = file.createReader();
      const entries = await readDirectory(directoryReader);
      await processFiles(entries, files);
    } else {
      files.push(file);
    }
  }
}

function readDirectory(directoryReader) {
  return new Promise((resolve, reject) => {
    directoryReader.readEntries(
      (entries) => {
        resolve(entries);
      },
      (error) => {
        reject(error);
      }
    );
  });
}

export async function selectFolder(cb) {
  const input = document.createElement("input");
  input.type = "file";
  input.setAttribute("directory", "");
  input.setAttribute("webkitdirectory", "");

  input.click();
  input.addEventListener("change", async (e) => {
    const fileList = input.files;
    if (!fileList.length) {
      return;
    }
    const files = [];
    await processFiles(fileList, files);
    cb && cb(files);
  });
}

export function download(filePath) {
  const a = document.createElement("a");
  a.download;
  a.href = filePath;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const selectFiles = (cb) => {
  const input = document.createElement("input");
  input.type = "file";
  if (navigator.userAgent.indexOf("Weixin") === -1) {
    input.multiple = "multiple";
  }
  input.click();
  input.addEventListener("change", (e) => {
    const files = e.target.files;
    if (!files.length) {
      return;
    }
    cb && cb(files);
  });
};
