#!/usr/bin/env bash
set -euo pipefail
iptables -w -N SABI-EGRESS 2>/dev/null || true
iptables -w -F SABI-EGRESS
iptables -w -A SABI-EGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
for net in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.168.0.0/16 198.18.0.0/15 224.0.0.0/4 240.0.0.0/4; do
  iptables -w -A SABI-EGRESS -d "$net" -j DROP
done
if [[ -n ${SABI_DENY_IPS:-} ]]; then iptables -w -A SABI-EGRESS -d "$SABI_DENY_IPS/32" -j DROP; fi
iptables -w -A SABI-EGRESS -p tcp --dport 443 -j ACCEPT
iptables -w -A SABI-EGRESS -j DROP
iptables -w -C DOCKER-USER -i sabi-egress -j SABI-EGRESS 2>/dev/null || iptables -w -I DOCKER-USER 1 -i sabi-egress -j SABI-EGRESS
for bridge in sabi-private sabi-egress; do
  iptables -w -C INPUT -i "$bridge" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || iptables -w -I INPUT 1 -i "$bridge" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  iptables -w -C INPUT -i "$bridge" -j DROP 2>/dev/null || iptables -w -I INPUT 2 -i "$bridge" -j DROP
  ip6tables -w -C INPUT -i "$bridge" -j DROP 2>/dev/null || ip6tables -w -I INPUT 1 -i "$bridge" -j DROP
  ip6tables -w -C FORWARD -i "$bridge" -j DROP 2>/dev/null || ip6tables -w -I FORWARD 1 -i "$bridge" -j DROP
done
