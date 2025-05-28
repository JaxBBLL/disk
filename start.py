#!/usr/bin/env python3

# nohup ./disk-start >> ./disk-start.log 2>&1 &

import os
import time
import subprocess
import signal
import sys

START_SCRIPT = "./disk-start"
LOG_FILE = "./disk-start.log"

def get_process_pid():
    """获取目标进程的 PID"""
    try:
        result = subprocess.check_output(["pgrep", "-f", START_SCRIPT])
        return result.decode().strip()
    except subprocess.CalledProcessError:
        return ""

def ensure_log_file():
    """确保日志文件存在"""
    if not os.path.exists(LOG_FILE):
        print(f"{time.asctime()} | 创建日志文件: {LOG_FILE}")
        open(LOG_FILE, 'a').close()

def start_process():
    """启动目标进程"""
    with open(LOG_FILE, 'a') as log:
        log.write(f"{time.asctime()} | 未检测到进程，触发保活: {START_SCRIPT}\n")
        subprocess.Popen(f"nohup {START_SCRIPT} >> {LOG_FILE} 2>&1 &", shell=True)

def handle_exit(signum, frame):
    print(f"\n{time.asctime()} | 收到退出信号({signum})，退出监控")
    sys.exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    print(f"{time.asctime()} | 进程保活监控已启动")
    while True:
        pid = get_process_pid()
        print(f"{time.asctime()} | 获取状态: {'存活' if pid else '未运行'}")

        if not pid:
            ensure_log_file()
            start_process()

        time.sleep(10)
