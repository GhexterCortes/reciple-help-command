import { CommandInteraction, EmbedFieldData, Message, MessageButton, MessageEmbed } from 'discord.js';
import { InteractionCommandBuilder, MessageCommandBuilder, RecipleClient, RecipleScript, version } from 'reciple';
import { ButtonType, OnDisableAction, Pagination } from '@ghextercortes/djs-pagination';

export type commandUsageInfo = { name: string; description: string; usage: string; type: string; builder: MessageCommandBuilder|InteractionCommandBuilder };

class Help implements RecipleScript {
    public versions: string[] = [version];
    public commands: (MessageCommandBuilder | InteractionCommandBuilder)[] = [];
    public allCommands: commandUsageInfo[] = [];

    public onStart() {
        this.commands.push(
            new MessageCommandBuilder()
                .setName('help')
                .setDescription('Get command help')
                .addOption(option => option
                    .setName('filter')
                    .setDescription('Filter commands')
                    .setRequired(false)
                )
                .setAllowExecuteByBots(false)
                .setAllowExecuteInDM(false)
                .setValidateOptions(true)
                .setExecute(async command => {
                    const filter = command.command.args?.join(' ') || '';

                    return this.getMessageHelp(command.message, filter);
                }),
            new InteractionCommandBuilder()
                .setName('help')
                .setDescription('Get command help')
                .addStringOption(option => option
                    .setName('filter')
                    .setDescription('Filter commands')
                    .setRequired(false)    
                )
                .setExecute(async command => {
                    const filter = command.interaction.options.getString('filter') || '';

                    return this.getInteractionHelp(command.interaction, filter);
                })
        );

        return true;
    }

    public onLoad(client: RecipleClient) {
        const commands = [...Object.values(client.commands.INTERACTION_COMMANDS), ...Object.values(client.commands.MESSAGE_COMMANDS)];

        for (const command of commands) {
            this.allCommands.push({
                name: command.name,
                description: command.description || '',
                usage: this.getUsage(command),
                type: command.builder,
                builder: command
            });
        }

    }

    public getUsage(command: MessageCommandBuilder|InteractionCommandBuilder, messageCommandPrefix: string = '!'): string {
        if ((command as MessageCommandBuilder).builder == 'MESSAGE_COMMAND') {
            let options = '';

            for (const option of (command as MessageCommandBuilder).options) {
                options += option.required ? `<${option.name}> ` : `[${option.name}] `;
            }

            return `${messageCommandPrefix}${command.name} ${options.trim()}`;
        } else if ((command as InteractionCommandBuilder).builder == 'INTERACTION_COMMAND') {
            let options = '';

            for (const option of (command as InteractionCommandBuilder).options) {
                const opt = option.toJSON();

                options += opt.required ? `<${opt.name}> ` : `[${opt.name}] `;
            }

            return `/${command.name} ${options.trim()}`;
        } else {
            return '';
        }
    }

    public getCommandHelp(command: MessageCommandBuilder|InteractionCommandBuilder) {
        const builder = (command as MessageCommandBuilder).builder === 'MESSAGE_COMMAND' ? (command as MessageCommandBuilder) : (command as InteractionCommandBuilder).toJSON();

        let optionFields: EmbedFieldData[] = [];

        for (const option of builder.options ?? []) {
            optionFields.push({
                name: option.name,
                value: '**'+ (option.required ? 'Required' : 'Optional') +'** — '+ option.description,
                inline: true
            });
        }

        return new MessageEmbed()
            .setAuthor({ name: `${builder.name}` })
            .setDescription(`${command.description}`)
            .addFields(optionFields)
            .setColor('BLUE');
    }

    public async getMessageHelp(command: Message, filter: string) {
        const commands = this.allCommands.filter(c => c.type === "MESSAGE_COMMAND" && (filter && c.name.indexOf(filter) > -1 || !filter));
        const exactCommand = this.allCommands.find(c => c.type === "MESSAGE_COMMAND" && c.name.toLowerCase() === filter.trim().toLowerCase());

        if (exactCommand) return command.reply({ content: ' ', embeds: [this.getCommandHelp(exactCommand.builder)] });

        if (!commands.length) return command.reply({ content: ' ', embeds: [new MessageEmbed().setAuthor({ name: `No commands found` }).setColor('RED')] });
        
        const pagination = this.generatePagination(commands);
        return pagination.paginate(command);
    }

    public async getInteractionHelp(command: CommandInteraction, filter: string) {
        let content = '';

        const commands = this.allCommands.filter(c => c.type === "INTERACTION_COMMAND" && (filter && c.name.indexOf(filter) > -1 || !filter));
        const exactCommand = this.allCommands.find(c => c.type === "INTERACTION_COMMAND" && c.name.toLowerCase() === filter.trim().toLowerCase());

        if (exactCommand) return command.reply({ content: ' ', embeds: [this.getCommandHelp(exactCommand.builder)] });
        if (!commands.length) return command.reply({ content: ' ', embeds: [new MessageEmbed().setAuthor({ name: `No commands found` }).setColor('RED')] });

        const pagination = this.generatePagination(commands);
        return pagination.paginate(command);
    }

    public generatePagination(commands: commandUsageInfo[]) {
        const contentLimit = 5;

        let pages: MessageEmbed[] = [];

        for (let i = 0; i < commands.length; i += contentLimit) {
            const page = new MessageEmbed().setColor('BLUE').setAuthor({ name: 'Commands' });

            for (let j = i; j < i + contentLimit; j++) {
                if (j >= commands.length) break;

                page.addFields([{
                    name: `${commands[j].name}`,
                    value: `${commands[j].description}\n\`\`\`\n${commands[j].usage}\n\`\`\``,
                    inline: false
                }]);
            }

            pages.push(page);
        }

        return new Pagination()
            .addPages(pages)
            .setAuthorIndependent(true)
            .setTimer(20000)
            .setOnDisableAction(OnDisableAction.DISABLE_BUTTONS)
            .setButtons(buttons => buttons
                .addButton(ButtonType.PREVIOUS_PAGE, new MessageButton().setLabel('Prev').setStyle('PRIMARY').setCustomId('previous')) 
                .addButton(ButtonType.NEXT_PAGE, new MessageButton().setLabel('Next').setStyle('SUCCESS').setCustomId('next'))
            );
    }
}

module.exports = new Help();
