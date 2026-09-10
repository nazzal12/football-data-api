import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("168.119.180.149", username="root", password="pHJgmdbe77fC", timeout=30, allow_agent=False, look_for_keys=False)
for cmd in [
    "docker ps -a --filter name=football --format '{{.Names}} {{.Status}}'",
    "ss -lntp | grep 8787 || echo 8787_FREE",
]:
    i,o,e=c.exec_command(cmd, timeout=30)
    print(cmd, "=>", (o.read()+e.read()).decode("utf-8","replace").strip())
c.close()
