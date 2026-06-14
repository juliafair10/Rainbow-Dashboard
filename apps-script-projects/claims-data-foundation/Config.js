const CONFIG = {
  database: {
    spreadsheetId: '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c'
  },

  historicalNotesArchive: {
    spreadsheetId: '1El1gDoh8GHvMfj8aFbV7pEH34vddo0DD2azT6p4XsSQ',
    sheetName: 'Historical_Notes'
  },

  folders: {
    dailyNotes: '1K1dZYR1djhBdmJ8ptathdPEcoSW33VyA',
    compliance: '1Ogn2856pN0VnFVlbON2-GIFzDGhhHNFV',
    historical: '1hFyhuJjcaSzGpixXI-bijiFGtmYRXhEz'
  },

  reports: {
    dailyNotes: {
      sender: 'no-reply@nextgearsolutions.com',
      filename: 'Daily Notes.xlsx'
    },

    compliance: {
      sender: 'no-reply@nextgearsolutions.com',
      filename: 'Compliance Tasks.xlsx'
    },

    historical: {
      sender: 'gen@rbwatl.com',
      filenameContains: 'Notes'
    }
  }
};
