# Production Deployment Guide

This guide explains how to deploy the Multiplayer Snake game to a production server using PM2.

## Prerequisites

- Node.js 18+ and npm installed
- A Linux server (Ubuntu/Debian recommended)
- Domain name (optional, for public access)
- Nginx (optional, for reverse proxy)

## Quick Deployment

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/Kurubik/snake.git
cd snake

# Run the deployment script
./deploy.sh
```

The deployment script will:
- Install PM2 globally if not present
- Install all dependencies
- Build production bundles
- Start both server and client with PM2
- Set up PM2 to start on system boot

## Manual Deployment

### 1. Install PM2

```bash
npm install -g pm2
npm install -g serve  # For serving static files
```

### 2. Configure Environment

Edit `client/.env.production`:
```bash
# Replace with your server's IP or domain
VITE_SERVER_URL=ws://YOUR_SERVER_IP:3005
# Or for SSL:
VITE_SERVER_URL=wss://yourdomain.com:3005
```

### 3. Build the Project

```bash
npm install
npm run build
```

### 4. Start with PM2

```bash
# Start all services
pm2 start ecosystem.config.json

# Or start individually
pm2 start server/dist/index.js --name snake-server
pm2 serve client/dist 5173 --name snake-client --spa

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

## PM2 Management Commands

```bash
# View status
pm2 status

# View logs
pm2 logs              # All logs
pm2 logs snake-server # Server logs only
pm2 logs snake-client # Client logs only

# Monitor in real-time
pm2 monit

# Restart services
pm2 restart all
pm2 restart snake-server
pm2 restart snake-client

# Stop services
pm2 stop all

# Delete from PM2
pm2 delete all
```

## Nginx Setup (Recommended)

### 1. Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

### 2. Configure Nginx

Copy the provided nginx configuration:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/snake
sudo ln -s /etc/nginx/sites-available/snake /etc/nginx/sites-enabled/
```

Edit the configuration:
```bash
sudo nano /etc/nginx/sites-available/snake
# Replace 'your-domain.com' with your actual domain
```

### 3. Test and Reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## SSL/HTTPS Setup with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

After SSL setup, update `client/.env.production`:
```bash
VITE_SERVER_URL=wss://your-domain.com/ws
```

## Firewall Configuration

```bash
# Allow ports
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 3005/tcp # WebSocket (if not using Nginx)
sudo ufw allow 5173/tcp # Client (if not using Nginx)

# Enable firewall
sudo ufw enable
```

## Environment-Specific Configurations

### Development Server
```bash
npm run dev
```

### Production Server
```bash
npm run deploy  # Uses deploy.sh script
# OR
npm run start:prod  # Start with PM2
npm run stop:prod   # Stop PM2 processes
npm run restart:prod # Restart PM2 processes
```

## Monitoring & Logs

### PM2 Monitoring
```bash
# Real-time monitoring dashboard
pm2 monit

# Process list with resource usage
pm2 list

# Display logs in real-time
pm2 logs --lines 100
```

### Log Files Location
- Server logs: `./logs/server-out.log` and `./logs/server-error.log`
- Client logs: `./logs/client-out.log` and `./logs/client-error.log`

### PM2 Web Dashboard (Optional)
```bash
# Install PM2 web dashboard
pm2 install pm2-logrotate  # Rotate logs automatically
pm2 web  # Start web dashboard on port 9615
```

## Performance Optimization

### 1. Enable Cluster Mode
The server is configured to run in cluster mode for better performance.

### 2. Memory Limits
The server will auto-restart if memory exceeds 500MB (configurable in `ecosystem.config.json`).

### 3. Log Rotation
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
sudo lsof -i :3005
sudo lsof -i :5173

# Kill process
kill -9 <PID>
```

### PM2 Not Starting on Boot
```bash
# Regenerate startup script
pm2 startup
# Follow the instructions provided
pm2 save
```

### WebSocket Connection Issues
1. Check firewall rules
2. Verify `VITE_SERVER_URL` in client build
3. Check Nginx WebSocket proxy configuration
4. Ensure server is listening on `0.0.0.0` not `localhost`

### Rebuild After Code Changes
```bash
git pull
npm install
npm run build
pm2 restart all
```

## Server Requirements

### Minimum:
- 1 CPU core
- 512MB RAM
- 1GB storage
- Ubuntu 20.04+ or similar

### Recommended:
- 2 CPU cores
- 1GB RAM
- 5GB storage
- Ubuntu 22.04 LTS

## Security Considerations

1. **Use HTTPS in Production**: Always use SSL/TLS for public deployments
2. **Firewall**: Only open necessary ports
3. **Updates**: Keep Node.js and dependencies updated
4. **Environment Variables**: Never commit `.env` files with sensitive data
5. **Rate Limiting**: Consider adding rate limiting for the WebSocket server
6. **DDoS Protection**: Use Cloudflare or similar service for public deployments

## Scaling

For high traffic:

1. **Horizontal Scaling**: Run multiple server instances with PM2 cluster mode
2. **Load Balancing**: Use Nginx upstream for multiple server instances
3. **Redis**: Add Redis for session/room management across instances
4. **CDN**: Serve client assets through a CDN

Example PM2 cluster configuration:
```javascript
{
  "apps": [{
    "name": "snake-server",
    "script": "./server/dist/index.js",
    "instances": "max",  // Use all CPU cores
    "exec_mode": "cluster"
  }]
}
```

## Support

For issues or questions:
- Check logs: `pm2 logs`
- GitHub Issues: https://github.com/Kurubik/snake/issues
- PM2 Documentation: https://pm2.keymetrics.io/
