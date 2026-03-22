/**
 * Convert milliseconds to readable formatted time
 * 
 * @param {number} ms - milliseconds
 * @returns {string} - DD HH, HH:MM, MM:SS, SS
 */
const msToTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}일${days > 1 ? '' : ''} ${hours % 24}시간${hours % 24 > 1 ? '' : ''}`;
    }
    else if (hours > 0) {
        return `${hours}시간${hours > 1 ? '' : ''} ${minutes % 60}분${minutes % 60 > 1 ? '' : ''}`;
    }
    else if (minutes > 0) {
        return `${minutes}분${minutes > 1 ? '' : ''} ${seconds % 60}초${seconds % 60 > 1 ? '' : ''}`;
    }
    else {
        return `${seconds % 60}초${seconds % 60 > 1 ? '' : ''}`;
    }
};