#!/usr/bin/env bash
# Egress policy for the Firefox container bridge (sabi-fx): public internet only, no private/metadata/own-IP.
set -euo pipefail
BR=sabi-fx
OWN_IP="${SABI_OWN_IP:-}"
iptables -w -N SABI-FX 2>/dev/null || true
iptables -w -F SABI-FX
iptables -w -A SABI-FX -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
for net in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.168.0.0/16 198.18.0.0/15 224.0.0.0/4 240.0.0.0/4; do
  iptables -w -A SABI-FX -d "$net" -j DROP
done
[[ -n "$OWN_IP" ]] && iptables -w -A SABI-FX -d "$OWN_IP/32" -j DROP
iptables -w -A SABI-FX -p udp --dport 53 -d 1.1.1.1 -j ACCEPT
iptables -w -A SABI-FX -p udp --dport 53 -d 8.8.8.8 -j ACCEPT
iptables -w -A SABI-FX -p tcp --dport 53 -d 1.1.1.1 -j ACCEPT
iptables -w -A SABI-FX -p tcp --dport 53 -d 8.8.8.8 -j ACCEPT
iptables -w -A SABI-FX -p udp --dport 53 -j DROP
iptables -w -A SABI-FX -p tcp -m multiport --dports 80,443 -j ACCEPT
iptables -w -A SABI-FX -p udp --dport 443 -j ACCEPT
iptables -w -A SABI-FX -j DROP
iptables -w -C DOCKER-USER -i $BR -j SABI-FX 2>/dev/null || iptables -w -I DOCKER-USER 1 -i $BR -j SABI-FX
iptables -w -C INPUT -i $BR -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || iptables -w -I INPUT 1 -i $BR -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -w -C INPUT -i $BR -j DROP 2>/dev/null || iptables -w -I INPUT 2 -i $BR -j DROP
ip6tables -w -C INPUT -i $BR -j DROP 2>/dev/null || ip6tables -w -I INPUT 1 -i $BR -j DROP
ip6tables -w -C FORWARD -i $BR -j DROP 2>/dev/null || ip6tables -w -I FORWARD 1 -i $BR -j DROP
